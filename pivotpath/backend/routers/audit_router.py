from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db, AuditLog
from audit_log import verify_chain
from security import get_current_worker
from database import Worker

router = APIRouter()

@router.get("/logs")
async def get_audit_logs(
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200)
    )
    logs = result.scalars().all()
    return [
        {
            "id": l.id,
            "event_type": l.event_type,
            "actor_id": l.actor_id,
            "actor_role": l.actor_role,
            "ip_address": l.ip_address,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "this_hash": l.this_hash,
        }
        for l in logs
    ]

@router.get("/verify")
async def verify_audit_chain(
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    return await verify_chain(db)