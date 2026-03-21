"""
Audit Log — append-only tamper-evident event log.
Each entry contains a hash of the previous entry, forming a chain.
"""
import hashlib
import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    actor_id = Column(String, nullable=True)
    actor_role = Column(String, nullable=True)
    payload = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    prev_hash = Column(String, nullable=False)
    this_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditEvent:
    # Auth events
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGIN_GEO_ANOMALY = "LOGIN_GEO_ANOMALY"
    LOGOUT = "LOGOUT"
    PASSWORD_CHANGED = "PASSWORD_CHANGED"
    REFRESH_TOKEN_REUSE_ATTACK = "REFRESH_TOKEN_REUSE_ATTACK"
    # User lifecycle
    WORKER_CREATED = "WORKER_CREATED"
    PROFILE_UPDATED = "PROFILE_UPDATED"
    HR_COMPANY_CREATED = "HR_COMPANY_CREATED"
    # Business events
    ISA_SIGNED = "ISA_SIGNED"
    CREDENTIAL_ENROLLED = "CREDENTIAL_ENROLLED"
    CREDENTIAL_COMPLETED = "CREDENTIAL_COMPLETED"
    INTERVIEW_BOOKED = "INTERVIEW_BOOKED"
    # Security events
    SQL_INJECTION_ATTEMPT = "SQL_INJECTION_ATTEMPT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    INVALID_TOKEN = "INVALID_TOKEN"
    # RAG/AI events
    RAG_EVAL = "RAG_EVAL"


def _compute_hash(prev_hash: str, payload: str) -> str:
    return hashlib.sha256(f"{prev_hash}{payload}".encode()).hexdigest()


async def _get_last_hash(db: AsyncSession) -> str:
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)
    )
    last = result.scalar()
    return last.this_hash if last else "GENESIS"


async def log_event(
    db: AsyncSession,
    event_type: str,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    payload: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Append a new tamper-evident event to the audit log."""
    try:
        payload_str = json.dumps(payload or {}, default=str)
        prev_hash = await _get_last_hash(db)
        this_hash = _compute_hash(prev_hash, payload_str)

        entry = AuditLog(
            id=str(uuid.uuid4()),
            event_type=event_type,
            actor_id=actor_id,
            actor_role=actor_role,
            payload=payload_str,
            ip_address=ip_address,
            prev_hash=prev_hash,
            this_hash=this_hash,
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        await db.commit()
    except Exception as e:
        print(f"[AuditLog] Failed to log {event_type}: {e}")


async def verify_chain(db: AsyncSession) -> dict:
    """Verify the integrity of the entire audit log chain."""
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.asc()))
    entries = result.scalars().all()

    if not entries:
        return {"intact": True, "entries": 0, "broken_at": None}

    prev_hash = "GENESIS"
    for i, entry in enumerate(entries):
        expected = _compute_hash(prev_hash, entry.payload)
        if entry.this_hash != expected:
            return {
                "intact": False,
                "entries": len(entries),
                "broken_at": i,
                "entry_id": entry.id
            }
        prev_hash = entry.this_hash

    return {"intact": True, "entries": len(entries), "broken_at": None}
