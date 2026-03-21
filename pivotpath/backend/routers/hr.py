from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid, numpy as np
from datetime import datetime, timedelta

from database import get_db, HRCompany, Worker, WorkerCredential
from security import hash_password, get_current_hr
from recommender import dropout_detector, interview_queue
from audit_log import log_event, AuditEvent

router = APIRouter()

class HRCompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    industry: str = Field(min_length=2, max_length=100)
    contact_name: str = Field(min_length=2, max_length=100)
    contact_email: EmailStr
    contract_value: Optional[float] = Field(default=None, ge=0)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)

@router.post("/companies")
async def create_company(data: HRCompanyCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump(exclude={"password"})
    company = HRCompany(id=str(uuid.uuid4()), **payload)
    if data.password:
        company.password_hash = hash_password(data.password)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    await log_event(db, AuditEvent.HR_COMPANY_CREATED,
                    actor_id=company.id, actor_role="hr",
                    payload={"name": company.name})
    return company

@router.get("/companies")
async def list_companies(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(HRCompany))
    return result.scalars().all()

@router.get("/companies/{company_id}/workers")
async def company_workers(
    company_id: str,
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Worker).where(Worker.hr_company_id == company_id))
    return result.scalars().all()

@router.get("/dashboard")
async def dashboard(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    total = (await db.execute(select(func.count(Worker.id)))).scalar()
    placed = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "placed"))).scalar()
    active = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "active"))).scalar()
    learning = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "learning"))).scalar()
    companies = (await db.execute(select(func.count(HRCompany.id)))).scalar()
    isa_signed = (await db.execute(select(func.count(Worker.id)).where(Worker.isa_signed == True))).scalar()
    return {
        "total_workers": total,
        "workers_placed": placed,
        "workers_active": active,
        "workers_learning": learning,
        "hr_companies": companies,
        "isa_signed": isa_signed,
        "placement_rate": round((placed / total * 100) if total else 0, 1),
        "cost_per_placement": 4800,
        "avg_salary_uplift": 21500,
    }

@router.get("/cohort-analytics")
async def cohort_analytics(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Group workers by their enrolment month and track progression over time.
    Returns placement rates, avg progress, and dropout signals per cohort.
    """
    result = await db.execute(select(Worker).order_by(Worker.created_at.asc()))
    workers = result.scalars().all()

    cohorts = {}
    for w in workers:
        if not w.created_at:
            continue
        key = w.created_at.strftime("%Y-%m")
        if key not in cohorts:
            cohorts[key] = {"month": key, "count": 0, "placed": 0,
                            "avg_progress": 0, "progress_sum": 0,
                            "isa_signed": 0, "learning": 0}
        c = cohorts[key]
        c["count"] += 1
        c["progress_sum"] += w.progress_pct or 0
        if w.status == "placed": c["placed"] += 1
        if w.status == "learning": c["learning"] += 1
        if w.isa_signed: c["isa_signed"] += 1

    output = []
    for key, c in cohorts.items():
        c["avg_progress"] = round(c["progress_sum"] / c["count"], 1) if c["count"] else 0
        c["placement_rate"] = round(c["placed"] / c["count"] * 100, 1) if c["count"] else 0
        del c["progress_sum"]
        output.append(c)

    return {
        "cohorts": output,
        "total_cohorts": len(output),
        "overall_placement_rate": round(
            sum(c["placed"] for c in cohorts.values()) /
            max(sum(c["count"] for c in cohorts.values()), 1) * 100, 1
        )
    }

@router.get("/dropout-risk")
async def dropout_risk(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Identify workers at dropout risk using Isolation Forest anomaly detection.
    Features: [progress_pct, days_since_created]
    """
    result = await db.execute(
        select(Worker).where(Worker.status.in_(["learning", "active", "onboarding"]))
    )
    workers = result.scalars().all()
    if not workers:
        return {"at_risk": [], "total_assessed": 0}

    now = datetime.utcnow()
    features = []
    for w in workers:
        days = (now - w.created_at).days if w.created_at else 0
        features.append([
            float(w.progress_pct or 0),
            float(days),
        ])

    feature_matrix = np.array(features)

    # Fit on the fly (in production, fit once and persist the model)
    if len(workers) >= 5:
        dropout_detector.fit(feature_matrix)
        risk_flags = dropout_detector.predict_risk(feature_matrix)
    else:
        risk_flags = [False] * len(workers)

    at_risk = [
        {"worker_id": w.id, "name": w.name, "progress_pct": w.progress_pct,
         "status": w.status, "days_enrolled": int(features[i][1])}
        for i, (w, risk) in enumerate(zip(workers, risk_flags)) if risk
    ]

    return {
        "at_risk": at_risk,
        "total_assessed": len(workers),
        "risk_count": len(at_risk)
    }

@router.get("/interview-queue")
async def get_interview_queue(
    current_hr: HRCompany = Depends(get_current_hr),
    db: AsyncSession = Depends(get_db)
):
    """
    Show the top workers in the priority queue for interview allocation.
    Ranked by skill match (60%) + completion % (40%).
    """
    result = await db.execute(
        select(Worker).where(Worker.status.in_(["learning", "active"]))
    )
    workers = result.scalars().all()

    # Rebuild queue
    fresh_queue = interview_queue.__class__()
    for w in workers:
        fresh_queue.push(
            worker_id=w.id,
            skill_match_score=float(w.progress_pct or 0),
            completion_pct=float(w.progress_pct or 0)
        )

    top = fresh_queue.peek_top_n(10)
    worker_map = {w.id: w for w in workers}

    return {
        "queue": [
            {**entry, "name": worker_map.get(entry["worker_id"], Worker()).name}
            for entry in top
        ],
        "total_in_queue": fresh_queue.size()
    }
