from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db, SkillSignal

router = APIRouter()

@router.get("/")
async def list_signals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SkillSignal).order_by(SkillSignal.demand_score.desc()))
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

@router.get("/top")
async def top_signals(limit: int = 5, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc()).limit(limit)
    )
    return result.scalars().all()
