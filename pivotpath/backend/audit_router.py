"""
Audit Router — exposes audit log endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from audit_log import AuditLog, verify_chain

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Return the most recent audit log entries."""
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    entries = result.scalars().all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "actor_id": e.actor_id,
            "actor_role": e.actor_role,
            "payload": e.payload,
            "ip_address": e.ip_address,
            "prev_hash": e.prev_hash,
            "this_hash": e.this_hash,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in entries
    ]


@router.get("/verify")
async def verify_audit_chain(db: AsyncSession = Depends(get_db)):
    """Verify the integrity of the entire audit log chain."""
    result = await verify_chain(db)
    if not result["intact"]:
        raise HTTPException(
            status_code=500,
            detail=f"Audit chain integrity broken at entry {result['broken_at']} "
                   f"(id: {result.get('entry_id')})",
        )
    return result
