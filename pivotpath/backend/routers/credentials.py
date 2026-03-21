from fastapi import APIRouter, Depends, HTTPException
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

router = APIRouter()

@router.get("/")
async def list_credentials(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Credential).order_by(Credential.demand_score.desc()))
    creds = result.scalars().all()
    out = []
    for c in creds:
        d = {k: v for k, v in c.__dict__.items() if not k.startswith("_")}
        try: d["skills_taught"] = json.loads(c.skills_taught or "[]")
        except: d["skills_taught"] = []
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
        await log_event(db, AuditEvent.CREDENTIAL_COMPLETED,
                        actor_id=wc.worker_id, actor_role="worker",
                        payload={"enrollment_id": enrollment_id})
    all_enroll = await db.execute(select(WorkerCredential).where(WorkerCredential.worker_id == wc.worker_id))
    enrollments = all_enroll.scalars().all()
    if enrollments:
        avg = sum(e.progress_pct or 0 for e in enrollments) // len(enrollments)
        worker_res = await db.execute(select(Worker).where(Worker.id == wc.worker_id))
        worker = worker_res.scalar()
        if worker:
            worker.progress_pct = avg
            if avg >= 100: worker.status = "job_seeking"
            elif avg > 0: worker.status = "learning"
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
        try: d["credential"]["skills_taught"] = json.loads(cred.skills_taught or "[]")
        except: d["credential"]["skills_taught"] = []
        out.append(d)
    return out

@router.get("/recommended/{worker_id}")
async def recommended_credentials(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """
    Collaborative filtering recommendations — credentials completed
    by workers similar to this one but not yet started by them.
    """
    # Build feature data for recommender
    all_enrollments = await db.execute(select(WorkerCredential))
    enrollments = [
        {"worker_id": e.worker_id, "credential_id": e.credential_id, "progress_pct": e.progress_pct}
        for e in all_enrollments.scalars().all()
    ]
    recommender.fit(enrollments)
    recs = recommender.recommend(worker_id, top_n=3)

    # Enrich with credential details
    enriched = []
    for rec in recs:
        cred_res = await db.execute(select(Credential).where(Credential.id == rec["credential_id"]))
        cred = cred_res.scalar()
        if cred:
            enriched.append({
                "credential_id": rec["credential_id"],
                "score": rec["score"],
                "title": cred.title,
                "provider": cred.provider,
                "duration_weeks": cred.duration_weeks,
                "placement_rate": cred.placement_rate
            })
    return enriched