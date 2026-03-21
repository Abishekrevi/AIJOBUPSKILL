from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
import uuid, re

from database import get_db, Worker
from security import hash_password, get_current_worker
from audit_log import log_event, AuditEvent

router = APIRouter()

def _strip_html(v):
    if v is None: return v
    return re.sub(r'<[^>]+>', '', str(v)).strip()

class WorkerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    current_role: str = Field(min_length=2, max_length=200)
    current_salary: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    target_role: Optional[str] = Field(default=None, max_length=200)
    skills_summary: Optional[str] = Field(default=None, max_length=2000)
    hr_company_id: Optional[str] = Field(default=None, max_length=64)

    @field_validator('name', 'current_role', 'target_role', 'skills_summary', mode='before')
    @classmethod
    def strip_html(cls, v): return _strip_html(v)

class WorkerUpdate(BaseModel):
    target_role: Optional[str] = Field(default=None, max_length=200)
    skills_summary: Optional[str] = Field(default=None, max_length=2000)
    current_role: Optional[str] = Field(default=None, max_length=200)
    current_salary: Optional[float] = Field(default=None, ge=0, le=10_000_000)
    status: Optional[str] = Field(default=None, max_length=50)
    progress_pct: Optional[int] = Field(default=None, ge=0, le=100)
    isa_signed: Optional[bool] = None

    @field_validator('target_role', 'skills_summary', 'current_role', mode='before')
    @classmethod
    def strip_html(cls, v): return _strip_html(v)

@router.post("/")
async def create_worker(data: WorkerCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.email == data.email))
    if result.scalar():
        raise HTTPException(status_code=400, detail="Email already registered")
    payload = data.model_dump(exclude={"password"})
    worker = Worker(id=str(uuid.uuid4()), **payload)
    if data.password:
        worker.password_hash = hash_password(data.password)
    db.add(worker)
    await db.commit()
    await db.refresh(worker)
    await log_event(db, AuditEvent.WORKER_CREATED,
                    actor_id=worker.id, actor_role="worker",
                    payload={"name": worker.name, "email": worker.email})
    return worker

@router.get("/{worker_id}")
async def get_worker(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    if current_worker.id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_worker

@router.patch("/{worker_id}")
async def update_worker(
    worker_id: str,
    data: WorkerUpdate,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    if current_worker.id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(current_worker, k, v)
    await db.commit()
    await db.refresh(current_worker)
    await log_event(db, AuditEvent.PROFILE_UPDATED,
                    actor_id=worker_id, actor_role="worker",
                    payload=data.model_dump(exclude_none=True))
    return current_worker

@router.get("/")
async def list_workers(
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Worker).where(Worker.id == current_worker.id))
    return result.scalars().all()