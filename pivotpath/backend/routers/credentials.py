"""
Credentials router — upgraded with DSA structures + event bus (47):
  26. Bloom filter   — O(1) duplicate enrollment check
  29. Skip list      — sorted credential ranking
  32. Union-Find     — skill cluster partial credit
  35. Suffix array   — full-text search
  47. Event bus      — publishes credential.completed event
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional
import uuid, json
from datetime import datetime

from database import get_db, Credential, WorkerCredential, Worker
from security import get_current_worker
from recommender import recommender
from audit_log import log_event, AuditEvent
from dsa_structures import (
    enroll_bloom, credential_ranking, skill_clusters,
    init_credential_ranking, init_bloom_from_enrollments,
    SuffixArray,
)

router = APIRouter()

# ─── Suffix array built lazily on first search ───────────────────────────────
_suffix_array: Optional[SuffixArray] = None
_sa_credential_ids: list[str] = []


async def _get_suffix_array(db: AsyncSession) -> SuffixArray:
    global _suffix_array, _sa_credential_ids
    if _suffix_array is None:
        result = await db.execute(select(Credential))
        creds = result.scalars().all()
        corpus = []
        _sa_credential_ids = []
        for c in creds:
            skills = ""
            try:
                skills = " ".join(json.loads(c.skills_taught or "[]"))
            except Exception:
                pass
            corpus.append(f"{c.title} {c.provider or ''} {skills}")
            _sa_credential_ids.append(c.id)
        _suffix_array = SuffixArray(corpus)
    return _suffix_array


@router.get("/")
async def list_credentials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Credential).order_by(Credential.demand_score.desc()))
    creds = result.scalars().all()
    out = []
    for c in creds:
        d = {k: v for k, v in c.__dict__.items() if not k.startswith("_")}
        try:
            d["skills_taught"] = json.loads(c.skills_taught or "[]")
        except:
            d["skills_taught"] = []
        out.append(d)
    return out


# ─── Upgrade 35: Full-text search ────────────────────────────────────────────
@router.get("/search")
async def search_credentials(
    q: str = Query(..., min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db)
):
    """Suffix array full-text search. O(m log n) query time."""
    sa = await _get_suffix_array(db)
    matches = sa.search(q.lower(), max_results=20)
    if not matches:
        return []
    cred_ids = [_sa_credential_ids[m["doc_index"]] for m in matches
                if m["doc_index"] < len(_sa_credential_ids)]
    result = await db.execute(select(Credential).where(Credential.id.in_(cred_ids)))
    creds = result.scalars().all()
    cred_map = {c.id: c for c in creds}
    out = []
    for cred_id in cred_ids:
        c = cred_map.get(cred_id)
        if c:
            d = {k: v for k, v in c.__dict__.items() if not k.startswith("_")}
            try:
                d["skills_taught"] = json.loads(c.skills_taught or "[]")
            except:
                d["skills_taught"] = []
            out.append(d)
    return out


class EnrollRequest(BaseModel):
    worker_id: str = Field(max_length=64)
    credential_id: str = Field(max_length=64)


@router.post("/enroll")
async def enroll(
    data: EnrollRequest,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    # ─── Upgrade 26: Bloom filter O(1) fast path ─────────────────────────────
    bloom_key = f"{data.worker_id}:{data.credential_id}"
    if bloom_key in enroll_bloom:
        existing = await db.execute(select(WorkerCredential).where(
            WorkerCredential.worker_id == data.worker_id,
            WorkerCredential.credential_id == data.credential_id
        ))
        if existing.scalar():
            raise HTTPException(status_code=400, detail="Already enrolled")

    wc = WorkerCredential(
        id=str(uuid.uuid4()),
        worker_id=data.worker_id,
        credential_id=data.credential_id,
        status="in_progress",
        started_at=datetime.utcnow(),
        progress_pct=0
    )
    db.add(wc)
    await db.commit()

    enroll_bloom.add(bloom_key)

    await log_event(db, AuditEvent.CREDENTIAL_ENROLLED,
                    actor_id=data.worker_id, actor_role="worker",
                    payload={"credential_id": data.credential_id})
    return {"enrolled": True, "enrollment_id": wc.id}


class ProgressUpdate(BaseModel):
    progress_pct: int = Field(ge=0, le=100)


@router.patch("/enrollment/{enrollment_id}/progress")
async def update_progress(
    enrollment_id: str,
    data: ProgressUpdate,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(WorkerCredential).where(WorkerCredential.id == enrollment_id))
    wc = result.scalar()
    if not wc:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    wc.progress_pct = data.progress_pct
    if data.progress_pct >= 100:
        wc.status = "completed"
        wc.completed_at = datetime.utcnow()

        # ── Upgrade 47: Publish event to async event bus ──────────────────────
        try:
            from circuit_breaker import bus, AppEvent
            await bus.publish(AppEvent.CREDENTIAL_COMPLETED, {
                "worker_id": wc.worker_id,
                "credential_id": wc.credential_id,
                "enrollment_id": enrollment_id,
            })
        except Exception:
            pass

        await log_event(db, AuditEvent.CREDENTIAL_COMPLETED,
                        actor_id=wc.worker_id, actor_role="worker",
                        payload={"enrollment_id": enrollment_id})

    all_enroll = await db.execute(select(WorkerCredential).where(
        WorkerCredential.worker_id == wc.worker_id
    ))
    enrollments = all_enroll.scalars().all()
    if enrollments:
        avg = sum(e.progress_pct or 0 for e in enrollments) // len(enrollments)
        worker_res = await db.execute(select(Worker).where(Worker.id == wc.worker_id))
        worker = worker_res.scalar()
        if worker:
            worker.progress_pct = avg
            if avg >= 100:
                worker.status = "job_seeking"
            elif avg > 0:
                worker.status = "learning"
            await db.commit()

    await db.commit()
    await db.refresh(wc)
    return wc


@router.get("/worker/{worker_id}")
async def worker_credentials(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(WorkerCredential, Credential)
        .join(Credential, WorkerCredential.credential_id == Credential.id)
        .where(WorkerCredential.worker_id == worker_id)
    )
    rows = result.all()
    out = []
    for wc, cred in rows:
        d = {k: v for k, v in wc.__dict__.items() if not k.startswith("_")}
        d["credential"] = {k: v for k, v in cred.__dict__.items() if not k.startswith("_")}
        try:
            d["credential"]["skills_taught"] = json.loads(cred.skills_taught or "[]")
        except:
            d["credential"]["skills_taught"] = []
        out.append(d)
    return out


@router.get("/recommended/{worker_id}")
async def recommended_credentials(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """Collaborative filtering + skill cluster partial credit (upgrade 32)."""
    all_enrollments = await db.execute(select(WorkerCredential))
    enrollments = [
        {"worker_id": e.worker_id, "credential_id": e.credential_id,
         "progress_pct": e.progress_pct}
        for e in all_enrollments.scalars().all()
    ]
    recommender.fit(enrollments)
    recs = recommender.recommend(worker_id, top_n=3)

    enriched = []
    for rec in recs:
        cred_res = await db.execute(select(Credential).where(Credential.id == rec["credential_id"]))
        cred = cred_res.scalar()
        if cred:
            try:
                skills = json.loads(cred.skills_taught or "[]")
                worker_res = await db.execute(select(Worker).where(Worker.id == worker_id))
                worker = worker_res.scalar()
                cluster_match = False
                if worker and worker.skills_summary:
                    for skill in skills:
                        for known in (worker.skills_summary or "").split(","):
                            if skill_clusters.same_cluster(skill.strip(), known.strip()):
                                cluster_match = True
                                break
            except Exception:
                cluster_match = False

            enriched.append({
                "credential_id": rec["credential_id"],
                "score": rec["score"],
                "title": cred.title,
                "provider": cred.provider,
                "duration_weeks": cred.duration_weeks,
                "placement_rate": cred.placement_rate,
                "cluster_match": cluster_match,
            })
    return enriched


# ─── Upgrade 29: Skip list ranked credentials ─────────────────────────────────
@router.get("/ranked")
async def ranked_credentials(
    top_n: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db)
):
    """Return credentials sorted by demand score using skip list. O(log n)."""
    top_items = credential_ranking.top_n(top_n, descending=True)
    if not top_items:
        result = await db.execute(
            select(Credential).order_by(Credential.demand_score.desc()).limit(top_n)
        )
        creds = result.scalars().all()
        for c in creds:
            credential_ranking.insert(float(c.demand_score or 0), c.id)
        top_items = credential_ranking.top_n(top_n, descending=True)

    cred_ids = [item["value"] for item in top_items]
    result = await db.execute(select(Credential).where(Credential.id.in_(cred_ids)))
    creds = {c.id: c for c in result.scalars().all()}

    out = []
    for item in top_items:
        c = creds.get(item["value"])
        if c:
            d = {k: v for k, v in c.__dict__.items() if not k.startswith("_")}
            try:
                d["skills_taught"] = json.loads(c.skills_taught or "[]")
            except:
                d["skills_taught"] = []
            d["skip_list_score"] = item["score"]
            out.append(d)
    return out


@router.get("/dsa-stats")
async def dsa_stats():
    return {
        "bloom_filter": {
            "items": len(enroll_bloom),
            "capacity": enroll_bloom.capacity,
            "estimated_false_positive_rate": round(
                enroll_bloom.estimated_false_positive_rate(), 6
            ),
            "hash_functions": enroll_bloom.hash_count,
        },
        "skip_list": {
            "items": len(credential_ranking),
            "description": "Sorted credential ranking by demand score",
        },
        "skill_clusters": {
            "clusters": len(skill_clusters.all_clusters()),
            "description": "Union-Find skill groupings",
        },
    }
