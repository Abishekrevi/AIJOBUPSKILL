from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid, json
from datetime import datetime

from database import get_db, Employer, InterviewBooking

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
    worker_id: str
    employer_id: str
    slot_date: str
    slot_time: str

@router.post("/book")
async def book_interview(data: BookingRequest, db: AsyncSession = Depends(get_db)):
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
    # Reduce available slots
    emp_res = await db.execute(select(Employer).where(Employer.id == data.employer_id))
    emp = emp_res.scalar()
    if emp and emp.interview_slots > 0:
        emp.interview_slots -= 1
    await db.commit()
    return {"booked": True, "booking_id": booking.id, "status": "confirmed"}

@router.get("/bookings/{worker_id}")
async def worker_bookings(worker_id: str, db: AsyncSession = Depends(get_db)):
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
        out.append(d)
    return out
