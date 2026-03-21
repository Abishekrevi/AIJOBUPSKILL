from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
import re

from database import get_db, Worker, HRCompany
from security import hash_password, verify_password, create_token
from audit_log import log_event, AuditEvent

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class WorkerLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class HRLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class SetPassword(BaseModel):
    worker_id: str = Field(max_length=64)
    password: str = Field(min_length=8, max_length=128)

@router.post("/worker/login")
@limiter.limit("5/minute")
async def worker_login(request: Request, data: WorkerLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.email == data.email))
    worker = result.scalar()
    dummy = "$2b$12$dummyhashtopreventtimingattacks1234567890123456"
    stored = worker.password_hash if (worker and worker.password_hash) else dummy
    valid = verify_password(data.password, stored) if (worker and worker.password_hash) else False
    if not worker or not valid:
        await log_event(db, AuditEvent.LOGIN_FAILED,
                        payload={"email": data.email},
                        ip_address=request.client.host)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(subject=worker.id, role="worker")
    await log_event(db, AuditEvent.LOGIN_SUCCESS,
                    actor_id=worker.id, actor_role="worker",
                    ip_address=request.client.host)
    return {"token": token, "worker": worker}

@router.post("/worker/set-password")
@limiter.limit("10/minute")
async def set_password(request: Request, data: SetPassword, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    worker.password_hash = hash_password(data.password)
    await db.commit()
    await log_event(db, AuditEvent.PASSWORD_CHANGED,
                    actor_id=worker.id, actor_role="worker",
                    ip_address=request.client.host)
    return {"success": True}

@router.post("/hr/login")
@limiter.limit("5/minute")
async def hr_login(request: Request, data: HRLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HRCompany).where(HRCompany.contact_email == data.email))
    company = result.scalar()
    dummy = "$2b$12$dummyhashtopreventtimingattacks1234567890123456"
    stored = company.password_hash if (company and company.password_hash) else dummy
    valid = verify_password(data.password, stored) if (company and company.password_hash) else False
    if not company or not valid:
        await log_event(db, AuditEvent.LOGIN_FAILED,
                        payload={"email": data.email, "role": "hr"},
                        ip_address=request.client.host)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(subject=company.id, role="hr")
    await log_event(db, AuditEvent.LOGIN_SUCCESS,
                    actor_id=company.id, actor_role="hr",
                    ip_address=request.client.host)
    return {"token": token, "company": company}