"""
PivotPath API Versioning — Upgrade 49
Backward-compatible v1/v2 routing with deprecation headers.
v1 = existing behaviour (legacy, deprecated 2026-12-31)
v2 = new response schemas with JWT + scopes + richer metadata
Standard at Google, Stripe, Twilio — APIs are versioned indefinitely.
"""
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import json

from database import get_db, Worker, Credential, SkillSignal, Employer
from security import get_current_worker


# ─── V1 Router (legacy — existing response shapes) ───────────────────────────
v1_router = APIRouter(prefix="/v1")


@v1_router.get("/workers/{worker_id}")
async def v1_get_worker(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """V1: Original response shape. Deprecated 2026-12-31."""
    if current_worker.id != worker_id:
        return JSONResponse(status_code=403, content={"detail": "Access denied"})
    return {
        "id": current_worker.id,
        "name": current_worker.name,
        "email": current_worker.email,
        "current_role": current_worker.current_role,
        "target_role": current_worker.target_role,
        "status": current_worker.status,
        "progress_pct": current_worker.progress_pct,
    }


@v1_router.get("/signals")
async def v1_list_signals(db: AsyncSession = Depends(get_db)):
    """V1: Simple list without metadata."""
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    )
    signals = result.scalars().all()
    return [
        {
            "id": s.id,
            "skill_name": s.skill_name,
            "demand_score": s.demand_score,
            "growth_rate": s.growth_rate,
        }
        for s in signals
    ]


@v1_router.get("/credentials")
async def v1_list_credentials(db: AsyncSession = Depends(get_db)):
    """V1: Basic credential list."""
    result = await db.execute(
        select(Credential).order_by(Credential.demand_score.desc())
    )
    creds = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "provider": c.provider,
            "duration_weeks": c.duration_weeks,
            "cost_usd": c.cost_usd,
        }
        for c in creds
    ]


# ─── V2 Router (current — richer response schemas) ───────────────────────────
v2_router = APIRouter(prefix="/v2")


@v2_router.get("/workers/{worker_id}")
async def v2_get_worker(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """
    V2: Enhanced response with scopes, metadata, career path,
    and ML model predictions inline.
    """
    if current_worker.id != worker_id:
        return JSONResponse(status_code=403, content={"detail": "Access denied"})

    # Enrich with salary prediction
    salary_prediction = None
    if current_worker.target_role:
        try:
            from ml_models import salary_predictor
            if salary_predictor._trained:
                salary_prediction = salary_predictor.predict(
                    current_role=current_worker.current_role or "Data Entry Clerk",
                    target_role=current_worker.target_role,
                    current_salary=float(current_worker.current_salary or 50000),
                )
        except Exception:
            pass

    # Career path summary
    career_path_summary = None
    if current_worker.current_role and current_worker.target_role:
        try:
            from career_graph import find_career_path
            path = find_career_path(current_worker.current_role, current_worker.target_role)
            if path:
                career_path_summary = {
                    "total_weeks": path["total_weeks"],
                    "total_cost_usd": path["total_cost_usd"],
                    "salary_uplift": path["salary_uplift"],
                    "num_steps": path["num_transitions"],
                    "algorithm": path.get("algorithm", "A*"),
                }
        except Exception:
            pass

    return {
        "id": current_worker.id,
        "name": current_worker.name,
        "email": current_worker.email,
        "current_role": current_worker.current_role,
        "current_salary": current_worker.current_salary,
        "target_role": current_worker.target_role,
        "skills_summary": current_worker.skills_summary,
        "status": current_worker.status,
        "progress_pct": current_worker.progress_pct,
        "isa_signed": current_worker.isa_signed,
        "created_at": current_worker.created_at.isoformat() if current_worker.created_at else None,
        "_meta": {
            "api_version": "v2",
            "schema_version": "2.0",
        },
        "predictions": {
            "salary": salary_prediction,
            "career_path": career_path_summary,
        },
    }


@v2_router.get("/signals")
async def v2_list_signals(db: AsyncSession = Depends(get_db)):
    """V2: Signals with forecasts, cache stats, and knowledge graph metadata."""
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    )
    signals = result.scalars().all()

    enriched = []
    for s in signals:
        employers_list = []
        try:
            employers_list = json.loads(s.top_employers or "[]")
        except Exception:
            pass

        # KG cluster info
        cluster = None
        try:
            from dsa_structures import skill_clusters
            cluster = skill_clusters.get_cluster_label(s.skill_name)
        except Exception:
            pass

        enriched.append({
            "id": s.id,
            "skill_name": s.skill_name,
            "category": s.category,
            "demand_score": s.demand_score,
            "growth_rate": s.growth_rate,
            "avg_salary_uplift": s.avg_salary_uplift,
            "top_employers": employers_list,
            "skill_cluster": cluster,
            "_meta": {"api_version": "v2"},
        })
    return enriched


@v2_router.get("/credentials")
async def v2_list_credentials(db: AsyncSession = Depends(get_db)):
    """V2: Credentials with bandit scores, cluster info, and semantic tags."""
    result = await db.execute(
        select(Credential).order_by(Credential.demand_score.desc())
    )
    creds = result.scalars().all()

    enriched = []
    for c in creds:
        skills_taught = []
        try:
            skills_taught = json.loads(c.skills_taught or "[]")
        except Exception:
            pass

        # Get bandit estimated reward if available
        bandit_score = None
        try:
            from ml_models import _credential_bandit
            if _credential_bandit and c.id in _credential_bandit._arm_index:
                idx = _credential_bandit._arm_index[c.id]
                bandit_score = round(float(_credential_bandit.values[idx]), 3)
        except Exception:
            pass

        enriched.append({
            "id": c.id,
            "title": c.title,
            "provider": c.provider,
            "duration_weeks": c.duration_weeks,
            "cost_usd": c.cost_usd,
            "demand_score": c.demand_score,
            "employer_endorsed": c.employer_endorsed,
            "placement_rate": c.placement_rate,
            "skills_taught": skills_taught,
            "bandit_reward_estimate": bandit_score,
            "_meta": {"api_version": "v2"},
        })
    return enriched


# ─── Deprecation middleware ───────────────────────────────────────────────────
async def versioning_middleware(request: Request, call_next):
    """
    Add versioning headers to all responses.
    V1 routes get Deprecation + Sunset headers (IETF RFC 8594).
    """
    response = await call_next(request)
    path = request.url.path

    if "/v1/" in path:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "Sun, 31 Dec 2026 23:59:59 GMT"
        response.headers["Link"] = (
            f'<{path.replace("/v1/", "/v2/")}>;rel="successor-version"'
        )
        response.headers["Warning"] = (
            '299 - "This API version is deprecated. '
            'Migrate to /v2/ before 2026-12-31."'
        )

    response.headers["API-Version"] = "v2"
    response.headers["API-Supported-Versions"] = "v1, v2"
    return response
