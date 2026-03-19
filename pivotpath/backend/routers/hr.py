from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import uuid, hashlib

from database import get_db, HRCompany, Worker

router = APIRouter()

def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()

class HRCompanyCreate(BaseModel):
    name: str
    industry: str
    contact_name: str
    contact_email: str
    contract_value: Optional[float] = None
    password: Optional[str] = None

@router.post("/companies")
async def create_company(data: HRCompanyCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump(exclude={"password"})
    company = HRCompany(id=str(uuid.uuid4()), **payload)
    if data.password:
        company.password_hash = hash_password(data.password)
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return company

@router.get("/companies")
async def list_companies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(HRCompany))
    return result.scalars().all()

@router.get("/companies/{company_id}/workers")
async def company_workers(company_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.hr_company_id == company_id))
    return result.scalars().all()

@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Worker.id)))).scalar()
    placed = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "placed"))).scalar()
    active = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "active"))).scalar()
    learning = (await db.execute(select(func.count(Worker.id)).where(Worker.status == "learning"))).scalar()
    companies = (await db.execute(select(func.count(HRCompany.id)))).scalar()
    isa_signed = (await db.execute(select(func.count(Worker.id)).where(Worker.isa_signed == True))).scalar()
    return {
        "total_workers": total,
        "workers_placed": placed,
        "workers_active": active,
        "workers_learning": learning,
        "hr_companies": companies,
        "isa_signed": isa_signed,
        "placement_rate": round((placed / total * 100) if total else 0, 1),
        "cost_per_placement": 4800,
        "avg_salary_uplift": 21500,
    }
