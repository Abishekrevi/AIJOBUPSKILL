from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid, hashlib, os

from database import get_db, Worker, HRCompany

router = APIRouter()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hashlib.sha256(password.encode()).hexdigest() == hashed

class WorkerLogin(BaseModel):
    email: str
    password: str

class HRLogin(BaseModel):
    email: str
    password: str

class SetPassword(BaseModel):
    worker_id: str
    password: str

@router.post("/worker/login")
async def worker_login(data: WorkerLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.email == data.email))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="No account found with that email")
    if worker.password_hash and not verify_password(data.password, worker.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return worker

@router.post("/worker/set-password")
async def set_password(data: SetPassword, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    worker.password_hash = hash_password(data.password)
    await db.commit()
    await db.refresh(worker)
    return {"success": True}

@router.post("/hr/login")
async def hr_login(data: HRLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HRCompany).where(HRCompany.contact_email == data.email))
    company = result.scalar()
    if not company:
        raise HTTPException(status_code=404, detail="No HR account found with that email")
    if company.password_hash and not verify_password(data.password, company.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password")
    return company
