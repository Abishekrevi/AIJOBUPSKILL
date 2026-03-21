from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import uuid, json
from datetime import datetime

from database import get_db, Employer, InterviewBooking, Worker
from security import get_current_worker
from audit_log import log_event, AuditEvent

router = APIRouter()

@router.get("/")
async def list_employers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Employer))
    employers = result.scalars().all()
    out = []
    for e in employers:
        d = {k: v for k, v in e.__dict__.items() if not k.startswith("_")}
        try: d["open_roles"] = json.loads(e.open_roles or "[]")
        except: d["open_roles"] = []
        try: d["skills_needed"] = json.loads(e.skills_needed or "[]")
        except: d["skills_needed"] = []
        out.append(d)
    return out

class BookingRequest(BaseModel):
    worker_id: str = Field(max_length=64)
    employer_id: str = Field(max_length=64)
    slot_date: str = Field(max_length=50)
    slot_time: str = Field(max_length=20)

@router.post("/book")
async def book_interview(
    data: BookingRequest,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(InterviewBooking).where(
        InterviewBooking.worker_id == data.worker_id,
        InterviewBooking.employer_id == data.employer_id
    ))
    if existing.scalar():
        raise HTTPException(status_code=400, detail="Already booked with this employer")

    booking = InterviewBooking(
        id=str(uuid.uuid4()),
        worker_id=data.worker_id,
        employer_id=data.employer_id,
        slot_date=data.slot_date,
        slot_time=data.slot_time,
        status="confirmed"
    )
    db.add(booking)

    emp_res = await db.execute(select(Employer).where(Employer.id == data.employer_id))
    emp = emp_res.scalar()
    if emp and emp.interview_slots > 0:
        emp.interview_slots -= 1

    await db.commit()

    await log_event(db, AuditEvent.INTERVIEW_BOOKED,
                    actor_id=data.worker_id, actor_role="worker",
                    payload={"employer_id": data.employer_id, "date": data.slot_date, "time": data.slot_time})

    return {"booked": True, "booking_id": booking.id, "status": "confirmed"}

@router.get("/bookings/{worker_id}")
async def worker_bookings(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(InterviewBooking, Employer)
        .join(Employer, InterviewBooking.employer_id == Employer.id)
        .where(InterviewBooking.worker_id == worker_id)
    )
    rows = result.all()
    out = []
    for booking, emp in rows:
        d = {k: v for k, v in booking.__dict__.items() if not k.startswith("_")}
        d["employer_name"] = emp.name
        d["employer_industry"] = emp.industry
        try: d["skills_needed"] = json.loads(emp.skills_needed or "[]")
        except: d["skills_needed"] = []
        out.append(d)
    return out

@router.get("/match/{worker_id}")
async def employer_match(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """Return employers ranked by skill match score for a given worker."""
    worker_res = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_res.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker_skills = (worker.skills_summary or "").lower()
    worker_target = (worker.target_role or "").lower()

    emp_res = await db.execute(select(Employer))
    employers = emp_res.scalars().all()

    scored = []
    for e in employers:
        try:
            skills_needed = json.loads(e.skills_needed or "[]")
            roles = json.loads(e.open_roles or "[]")
        except:
            skills_needed, roles = [], []

        skill_matches = sum(1 for s in skills_needed if s.lower().split()[0] in worker_skills)
        role_match = any(worker_target in r.lower() for r in roles)
        score = round((skill_matches / max(len(skills_needed), 1)) * 80 + (20 if role_match else 0))

        d = {k: v for k, v in e.__dict__.items() if not k.startswith("_")}
        d["open_roles"] = roles
        d["skills_needed"] = skills_needed
        d["match_score"] = score
        scored.append(d)

    return sorted(scored, key=lambda x: x["match_score"], reverse=True)