from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from database import get_db, GigPost

router = APIRouter()

@router.get("/")
async def list_gigs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(GigPost).order_by(GigPost.rate_per_day.desc()))
    gigs = result.scalars().all()
    out = []
    for g in gigs:
        d = {k: v for k, v in g.__dict__.items() if not k.startswith("_")}
        try: d["skills_needed"] = json.loads(g.skills_needed or "[]")
        except: d["skills_needed"] = []
        out.append(d)
    return out
