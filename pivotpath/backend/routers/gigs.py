from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import json

from database import get_db, GigPost

router = APIRouter()

@router.get("/")
async def list_gigs(
    remote: Optional[bool] = Query(None),
    min_rate: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    query = select(GigPost).order_by(GigPost.rate_per_day.desc())
    result = await db.execute(query)
    gigs = result.scalars().all()
    out = []
    for g in gigs:
        if remote is not None and g.remote != remote:
            continue
        if min_rate is not None and g.rate_per_day < min_rate:
            continue
        d = {k: v for k, v in g.__dict__.items() if not k.startswith("_")}
        try: d["skills_needed"] = json.loads(g.skills_needed or "[]")
        except: d["skills_needed"] = []
        out.append(d)
    return out

@router.get("/stats")
async def gig_stats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GigPost))
    gigs = result.scalars().all()
    if not gigs:
        return {}
    avg_rate = round(sum(g.rate_per_day for g in gigs) / len(gigs))
    max_rate = max(g.rate_per_day for g in gigs)
    remote_count = sum(1 for g in gigs if g.remote)
    return {
        "total_gigs": len(gigs),
        "avg_day_rate": avg_rate,
        "max_day_rate": max_rate,
        "remote_count": remote_count,
        "onsite_count": len(gigs) - remote_count,
    }
