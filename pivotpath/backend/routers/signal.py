"""
Signal router — upgraded with DSA structures:
  28. LFU cache — frequency-based caching of hot skill signal endpoints
  30. Segment tree — O(log n) range analytics on skill demand history
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import json, time

from database import get_db, SkillSignal
from dsa_structures import signal_cache, SegmentTree

router = APIRouter()

# Segment tree built lazily from signal demand scores
_demand_segment_tree: Optional[SegmentTree] = None
_demand_signal_ids: list[str] = []


async def _get_demand_tree(db: AsyncSession):
    global _demand_segment_tree, _demand_signal_ids
    if _demand_segment_tree is None:
        result = await db.execute(
            select(SkillSignal).order_by(SkillSignal.demand_score.desc())
        )
        signals = result.scalars().all()
        _demand_signal_ids = [s.id for s in signals]
        scores = [int(s.demand_score or 0) for s in signals]
        if scores:
            _demand_segment_tree = SegmentTree(scores)
    return _demand_segment_tree


def _serialize_signals(signals) -> list:
    out = []
    for s in signals:
        d = {k: v for k, v in s.__dict__.items() if not k.startswith("_")}
        try:
            d["top_employers"] = json.loads(s.top_employers or "[]")
        except Exception:
            d["top_employers"] = []
        out.append(d)
    return out


@router.get("/")
async def list_signals(
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # ─── Upgrade 28: LFU cache check ─────────────────────────────────────────
    cache_key = f"signals:all:{category or 'all'}"
    cached = signal_cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    )
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

    # Cache result with LFU (most frequently accessed = never evicted)
    signal_cache.put(cache_key, out)
    return out


@router.get("/top")
async def top_signals(limit: int = 5, db: AsyncSession = Depends(get_db)):
    cache_key = f"signals:top:{limit}"
    cached = signal_cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc()).limit(limit)
    )
    signals = result.scalars().all()
    out = _serialize_signals(signals)
    signal_cache.put(cache_key, out)
    return out


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    cached = signal_cache.get("signals:categories")
    if cached:
        return cached
    result = await db.execute(select(SkillSignal.category).distinct())
    cats = sorted([r[0] for r in result.all() if r[0]])
    data = {"categories": cats}
    signal_cache.put("signals:categories", data)
    return data


@router.get("/summary")
async def signal_summary(db: AsyncSession = Depends(get_db)):
    cached = signal_cache.get("signals:summary")
    if cached:
        return cached

    result = await db.execute(select(SkillSignal))
    signals = result.scalars().all()
    if not signals:
        return {}

    avg_demand = round(sum(s.demand_score for s in signals) / len(signals), 1)
    avg_growth = round(sum(s.growth_rate for s in signals) / len(signals), 1)
    avg_uplift = round(sum(s.avg_salary_uplift for s in signals) / len(signals))
    top = max(signals, key=lambda s: s.demand_score)
    fastest = max(signals, key=lambda s: s.growth_rate)
    data = {
        "total_skills": len(signals),
        "avg_demand_score": avg_demand,
        "avg_growth_rate": avg_growth,
        "avg_salary_uplift": avg_uplift,
        "hottest_skill": top.skill_name,
        "fastest_growing": fastest.skill_name,
    }
    signal_cache.put("signals:summary", data)
    return data


# ─── Upgrade 30: Segment tree range analytics ─────────────────────────────────
@router.get("/range-analytics")
async def range_analytics(
    from_idx: int = Query(default=0, ge=0),
    to_idx: int = Query(default=6, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    Upgrade 30: Segment tree range queries on skill demand scores.
    Returns sum and max demand score over an index range in O(log n).
    Useful for analytics dashboards — "what's the total demand across top 3 skills?"
    """
    tree = await _get_demand_tree(db)
    if not tree or tree.n == 0:
        return {"error": "No signal data available"}

    n = tree.n
    l = max(0, min(from_idx, n - 1))
    r = max(0, min(to_idx, n - 1))
    if l > r:
        l, r = r, l

    range_sum = tree.range_sum(l, r)
    range_max = tree.range_max(l, r)
    avg = round(range_sum / (r - l + 1), 1)

    # Get signal names for the range
    result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc())
    )
    signals = result.scalars().all()
    range_skills = [
        {"skill": signals[i].skill_name, "demand": int(signals[i].demand_score or 0)}
        for i in range(l, min(r + 1, len(signals)))
    ]

    return {
        "range": [l, r],
        "range_sum": range_sum,
        "range_max": range_max,
        "range_avg": avg,
        "skills_in_range": range_skills,
        "algorithm": "Segment Tree O(log n)",
    }


# ─── Cache stats ──────────────────────────────────────────────────────────────
@router.get("/cache-stats")
async def cache_stats():
    """Upgrade 28: LFU cache hit/miss statistics."""
    return {
        "lfu_cache": signal_cache.stats(),
        "description": "Least Frequently Used cache — most popular signals never evicted",
    }


@router.post("/cache/invalidate")
async def invalidate_cache():
    """Invalidate all signal caches (call after updating signal data)."""
    for key in list(signal_cache.cache.keys()):
        signal_cache.invalidate(key)
    global _demand_segment_tree
    _demand_segment_tree = None
    return {"invalidated": True}
