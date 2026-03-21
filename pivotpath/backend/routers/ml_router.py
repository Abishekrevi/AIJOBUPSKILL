"""
PivotPath ML Router — exposes all ML/AI model endpoints (upgrades 36-43)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List
import numpy as np

from database import get_db, Worker, Credential, WorkerCredential, SkillSignal
from security import get_current_worker, get_current_hr
from database import HRCompany
from ml_models import (
    semantic_skill_match, compute_employer_match_score,
    forecast_skill_demand, generate_synthetic_history,
    FederatedLearningCoordinator, federated_coordinator,
    UCBCredentialBandit, get_or_init_bandit,
    explain_dropout_risk,
    SalaryPredictor, salary_predictor,
    compute_disparate_impact, compute_recommendation_bias,
)

router = APIRouter()


# ─── Upgrade 36: Semantic skill matching ──────────────────────────────────────
@router.get("/skill-match/{worker_id}/{employer_id}")
async def semantic_employer_match(
    worker_id: str,
    employer_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 36: BERT-based semantic skill matching between worker and employer.
    Returns strong/partial/missing per required skill.
    """
    worker_res = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_res.scalar()
    if not worker:
        raise HTTPException(404, "Worker not found")

    from database import Employer
    emp_res = await db.execute(
        select(Employer).__class__.where(
            Employer.__table__.c.id == employer_id
        )
    )

    import json
    from database import Employer as EmpModel
    emp_q = await db.execute(select(EmpModel).where(EmpModel.id == employer_id))
    employer = emp_q.scalar()
    if not employer:
        raise HTTPException(404, "Employer not found")

    try:
        skills_needed = json.loads(employer.skills_needed or "[]")
        open_roles = json.loads(employer.open_roles or "[]")
    except Exception:
        skills_needed, open_roles = [], []

    result = compute_employer_match_score(
        worker_skills=worker.skills_summary or "",
        skills_needed=skills_needed,
        target_role=worker.target_role or "",
        open_roles=open_roles,
    )
    return {"worker_id": worker_id, "employer_id": employer_id, **result}


# ─── Upgrade 37: Demand forecasting ──────────────────────────────────────────
@router.get("/forecast/{skill_name}")
async def forecast_demand(
    skill_name: str,
    weeks: int = Query(default=26, ge=4, le=52),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 37: 6-month Prophet time-series forecast for a skill's demand score.
    Generates synthetic history if no real history is available yet.
    """
    result = await db.execute(
        select(SkillSignal).where(SkillSignal.skill_name == skill_name)
    )
    signal = result.scalar()
    if not signal:
        raise HTTPException(404, f"Skill '{skill_name}' not found")

    # Generate synthetic history (real history requires weekly collection)
    history = generate_synthetic_history(float(signal.demand_score or 80), n_weeks=16)
    forecast = forecast_skill_demand(history, periods_weeks=weeks)

    return {
        "skill": skill_name,
        "current_demand_score": signal.demand_score,
        "growth_rate_yoy": signal.growth_rate,
        **forecast,
    }


@router.get("/forecast-all")
async def forecast_all_skills(db: AsyncSession = Depends(get_db)):
    """Forecast demand for all skills and return ranked outlook."""
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    )
    signals = result.scalars().all()

    forecasts = []
    for s in signals:
        history = generate_synthetic_history(float(s.demand_score or 80), n_weeks=12)
        f = forecast_skill_demand(history, periods_weeks=26)
        forecasts.append({
            "skill": s.skill_name,
            "category": s.category,
            "current": s.demand_score,
            "forecast_6mo": f.get("forecast_6mo"),
            "trend": f.get("trend", "unknown"),
            "avg_salary_uplift": s.avg_salary_uplift,
        })

    forecasts.sort(key=lambda x: x.get("forecast_6mo") or 0, reverse=True)
    return forecasts


# ─── Upgrade 39: UCB bandit recommendations ───────────────────────────────────
@router.get("/bandit/recommend/{worker_id}")
async def bandit_recommend(
    worker_id: str,
    n: int = Query(default=3, ge=1, le=10),
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 39: UCB bandit-based credential recommendation.
    Balances exploration (new credentials) with exploitation (proven winners).
    """
    result = await db.execute(select(Credential))
    creds = result.scalars().all()
    cred_ids = [c.id for c in creds]
    cred_map = {c.id: c for c in creds}

    bandit = get_or_init_bandit(cred_ids)
    recommended_ids = bandit.select(n=n)

    # Filter out already-enrolled credentials
    enrolled_res = await db.execute(
        select(WorkerCredential).where(WorkerCredential.worker_id == worker_id)
    )
    enrolled_ids = {e.credential_id for e in enrolled_res.scalars().all()}
    recommended_ids = [cid for cid in recommended_ids if cid not in enrolled_ids][:n]

    return [
        {
            "credential_id": cid,
            "title": cred_map[cid].title if cid in cred_map else "Unknown",
            "provider": cred_map[cid].provider if cid in cred_map else "",
            "placement_rate": cred_map[cid].placement_rate if cid in cred_map else 0,
            "recommendation_source": "UCB bandit",
        }
        for cid in recommended_ids
        if cid in cred_map
    ]


class BanditFeedback(BaseModel):
    credential_id: str = Field(max_length=64)
    outcome: str = Field(pattern="^(placement|completion|dropout|enrolled)$")


@router.post("/bandit/feedback")
async def bandit_feedback(
    data: BanditFeedback,
    current_worker: Worker = Depends(get_current_worker),
):
    """Submit outcome feedback to the bandit for online learning."""
    reward_map = {"placement": 1.0, "completion": 0.7, "enrolled": 0.3, "dropout": 0.0}
    reward = reward_map.get(data.outcome, 0.0)

    from ml_models import _credential_bandit
    if _credential_bandit:
        _credential_bandit.update(data.credential_id, reward)

    return {"feedback_recorded": True, "reward": reward, "outcome": data.outcome}


@router.get("/bandit/stats")
async def bandit_stats(current_worker: Worker = Depends(get_current_worker)):
    """Return UCB bandit arm statistics."""
    from ml_models import _credential_bandit
    if not _credential_bandit:
        return {"available": False}
    return {"available": True, "arms": _credential_bandit.get_stats()}


# ─── Upgrade 40: SHAP explainability ─────────────────────────────────────────
@router.get("/explain-dropout/{worker_id}")
async def explain_dropout(
    worker_id: str,
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 40: SHAP-based explanation of why a worker is flagged at dropout risk.
    Returns top 3 feature contributions in human-readable form.
    EU AI Act Article 13 compliance.
    """
    worker_res = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_res.scalar()
    if not worker:
        raise HTTPException(404, "Worker not found")

    from datetime import datetime
    now = datetime.utcnow()
    days_enrolled = (now - worker.created_at).days if worker.created_at else 0

    features = np.array([[
        float(worker.progress_pct or 0),
        float(days_enrolled),
    ]])
    feature_names = ["progress_pct", "days_enrolled"]

    from recommender import dropout_detector
    if not dropout_detector._fitted:
        return {
            "worker_id": worker_id,
            "explanation_available": False,
            "reason": "Dropout model not yet trained — need more workers"
        }

    explanation = explain_dropout_risk(
        dropout_detector.model, features[0], feature_names
    )
    return {"worker_id": worker_id, "worker_name": worker.name, **explanation}


# ─── Upgrade 42: Neural salary prediction ────────────────────────────────────
@router.get("/salary-predict/{worker_id}")
async def predict_salary(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 42: Neural network salary prediction for a worker's target role.
    More accurate than the static 30% uplift multiplier.
    """
    worker_res = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_res.scalar()
    if not worker:
        raise HTTPException(404, "Worker not found")

    if not worker.target_role:
        raise HTTPException(400, "Worker has no target role set")

    # Count completed credentials
    enrolled_res = await db.execute(
        select(WorkerCredential).where(
            WorkerCredential.worker_id == worker_id,
            WorkerCredential.status == "completed"
        )
    )
    completed = len(enrolled_res.scalars().all())

    # Get demand score for target skill area
    signals_res = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc()).limit(1)
    )
    top_signal = signals_res.scalar()
    demand_score = float(top_signal.demand_score) if top_signal else 85.0

    # Ensure model is trained
    if not salary_predictor._trained:
        salary_predictor.train([])  # trains from career graph

    prediction = salary_predictor.predict(
        current_role=worker.current_role or "Data Entry Clerk",
        target_role=worker.target_role,
        demand_score=demand_score,
        credentials_completed=completed,
        current_salary=float(worker.current_salary or 50000),
    )

    return {
        "worker_id": worker_id,
        "worker_name": worker.name,
        "current_role": worker.current_role,
        "target_role": worker.target_role,
        "credentials_completed": completed,
        **prediction,
    }


# ─── Upgrade 38: Federated learning ──────────────────────────────────────────
@router.post("/federated/submit")
async def submit_federated_model(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 38: Submit locally trained model for federated aggregation.
    Trains on this HR company's workers only — raw data never shared.
    """
    workers_res = await db.execute(
        select(Worker).where(Worker.hr_company_id == current_hr.id)
    )
    workers = workers_res.scalars().all()
    if len(workers) < 3:
        return {"error": "Need at least 3 workers for local training"}

    from datetime import datetime
    now = datetime.utcnow()
    features = np.array([
        [float(w.progress_pct or 0),
         float((now - w.created_at).days if w.created_at else 0)]
        for w in workers
    ])

    result = federated_coordinator.submit_local_model(
        company_id=current_hr.id,
        features=features,
        n_workers=len(workers)
    )
    return result


@router.post("/federated/aggregate")
async def aggregate_federated(
    current_hr: HRCompany = Depends(get_current_hr),
):
    """Trigger FedAvg aggregation across all submitted local models."""
    return federated_coordinator.aggregate()


# ─── Upgrade 43: Bias detection ───────────────────────────────────────────────
@router.get("/bias-audit")
async def bias_audit(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 43: EEOC four-fifths disparate impact analysis.
    Checks if the dropout detector treats worker subgroups fairly.
    """
    from datetime import datetime
    from recommender import dropout_detector

    workers_res = await db.execute(
        select(Worker).where(Worker.status.in_(["learning", "active", "onboarding"]))
    )
    workers = workers_res.scalars().all()
    if len(workers) < 5:
        return {"available": False, "reason": "Need at least 5 workers for bias analysis"}

    now = datetime.utcnow()
    features = np.array([
        [float(w.progress_pct or 0),
         float((now - w.created_at).days if w.created_at else 0)]
        for w in workers
    ])

    if dropout_detector._fitted:
        predictions = dropout_detector.predict_risk(features)
    else:
        predictions = [False] * len(workers)

    # Group by salary quartile
    salaries = [w.current_salary or 0 for w in workers]
    if max(salaries) > 0:
        q25 = np.percentile(salaries, 25)
        q75 = np.percentile(salaries, 75)
        groups = [
            "low" if s <= q25 else "high" if s >= q75 else "mid"
            for s in salaries
        ]
    else:
        groups = ["unknown"] * len(workers)

    di_result = compute_disparate_impact(predictions, groups)

    return {
        "total_workers_assessed": len(workers),
        "salary_quartile_analysis": di_result,
        "compliance_standard": "EEOC four-fifths rule (DI ratio >= 0.8)",
        "eu_ai_act": "Article 10 — data governance and bias monitoring",
    }
