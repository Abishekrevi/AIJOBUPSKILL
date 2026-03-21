from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import json

from database import get_db, SkillSignal
from security import get_current_worker
from database import Worker

router = APIRouter()

@router.get("/")
async def list_signals(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    result = await db.execute(query)
    signals = result.scalars().all()
    out = []
    for s in signals:
        if category and s.category and s.category.lower() != category.lower():
            continue
        d = {k: v for k, v in s.__dict__.items() if not k.startswith("_")}
        try:
            d["top_employers"] = json.loads(s.top_employers or "[]")
        except Exception:
            d["top_employers"] = []
        out.append(d)
    return out

@router.get("/top")
async def top_signals(limit: int = 5, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc()).limit(limit)
    )
    signals = result.scalars().all()
    out = []
    for s in signals:
        d = {k: v for k, v in s.__dict__.items() if not k.startswith("_")}
        try:
            d["top_employers"] = json.loads(s.top_employers or "[]")
        except Exception:
            d["top_employers"] = []
        out.append(d)
    return out

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillSignal.category).distinct())
    cats = [r[0] for r in result.all() if r[0]]
    return {"categories": sorted(cats)}

@router.get("/summary")
async def signal_summary(db: AsyncSession = Depends(get_db)):
    """Aggregate summary stats for all skill signals."""
    result = await db.execute(select(SkillSignal))
    signals = result.scalars().all()
    if not signals:
        return {}
    avg_demand = round(sum(s.demand_score for s in signals) / len(signals), 1)
    avg_growth = round(sum(s.growth_rate for s in signals) / len(signals), 1)
    avg_uplift = round(sum(s.avg_salary_uplift for s in signals) / len(signals))
    top = max(signals, key=lambda s: s.demand_score)
    fastest = max(signals, key=lambda s: s.growth_rate)
    return {
        "total_skills": len(signals),
        "avg_demand_score": avg_demand,
        "avg_growth_rate": avg_growth,
        "avg_salary_uplift": avg_uplift,
        "hottest_skill": top.skill_name,
        "fastest_growing": fastest.skill_name,
    }