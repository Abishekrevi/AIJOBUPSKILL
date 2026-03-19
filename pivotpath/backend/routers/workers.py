from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid, hashlib

from database import get_db, Worker

router = APIRouter()

def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()

class WorkerCreate(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    current_role: str
    current_salary: Optional[float] = None
    target_role: Optional[str] = None
    skills_summary: Optional[str] = None
    hr_company_id: Optional[str] = None

class WorkerUpdate(BaseModel):
    target_role: Optional[str] = None
    skills_summary: Optional[str] = None
    current_role: Optional[str] = None
    current_salary: Optional[float] = None
    status: Optional[str] = None
    progress_pct: Optional[int] = None
    isa_signed: Optional[bool] = None

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
    return worker

@router.get("/{worker_id}")
async def get_worker(worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker

@router.patch("/{worker_id}")
async def update_worker(worker_id: str, data: WorkerUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(worker, k, v)
    await db.commit()
    await db.refresh(worker)
    return worker

@router.get("/")
async def list_workers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker))
    return result.scalars().all()
