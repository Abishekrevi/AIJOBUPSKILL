from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import numpy as np
from typing import List
import json

from database import get_db, Worker, WorkerCredential, Credential

router = APIRouter()

class SkillPredictor:
    def __init__(self):
        self.weights = None
    
    def predict_completion_time(self, 
                               current_progress: int,
                               avg_daily_progress: float,
                               difficulty: int) -> dict:
        if avg_daily_progress <= 0:
            avg_daily_progress = 0.5
        
        remaining = 100 - current_progress
        adjusted_progress = avg_daily_progress * (1 / (difficulty / 5))
        days_to_complete = remaining / adjusted_progress if adjusted_progress > 0 else 365
        
        return {
            "current_progress": current_progress,
            "estimated_completion_days": round(days_to_complete),
            "completion_date": None,
            "confidence": min(100, 40 + (avg_daily_progress * 10))
        }
    
    def predict_success_rate(self, 
                            worker_completion_rate: float,
                            credential_completion_rate: float,
                            time_invested_hours: int) -> float:
        worker_feature = worker_completion_rate / 100
        cred_feature = credential_completion_rate / 100
        time_feature = min(time_invested_hours / 100, 1.0)
        
        hidden_1 = (worker_feature * 0.4 + cred_feature * 0.35 + time_feature * 0.25)
        hidden_2 = np.tanh(hidden_1)
        output = (hidden_2 + 1) / 2 * 100
        
        return round(float(output), 2)

predictor = SkillPredictor()

@router.post("/predict-completion/{worker_id}/{credential_id}")
async def predict_completion(worker_id: str, credential_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkerCredential).where(
            (WorkerCredential.worker_id == worker_id) &
            (WorkerCredential.credential_id == credential_id)
        )
    )
    enrollment = result.scalar()
    
    if not enrollment:
        return {"error": "Enrollment not found"}
    
    days_enrolled = max((enrollment.updated_at - enrollment.started_at).days, 1)
    avg_daily_progress = enrollment.progress_pct / days_enrolled
    
    cred_result = await db.execute(select(Credential).where(Credential.id == credential_id))
    cred = cred_result.scalar()
    difficulty = int(cred.demand_score / 20) if cred else 3
    
    prediction = predictor.predict_completion_time(
        enrollment.progress_pct,
        avg_daily_progress,
        difficulty
    )
    
    return {
        "worker_id": worker_id,
        "credential_id": credential_id,
        "enrollment_id": enrollment.id,
        **prediction
    }

@router.get("/predict-success/{worker_id}")
async def predict_success(worker_id: str, db: AsyncSession = Depends(get_db)):
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar()
    
    if not worker:
        return {"error": "Worker not found"}
    
    enroll_result = await db.execute(
        select(WorkerCredential).where(WorkerCredential.worker_id == worker_id)
    )
    enrollments = enroll_result.scalars().all()
    
    if not enrollments:
        return {"success_rate": 0, "reason": "No enrollments yet"}
    
    completed = len([e for e in enrollments if e.status == "completed"])
    completion_rate = (completed / len(enrollments)) * 100
    
    avg_progress = sum(e.progress_pct for e in enrollments) / len(enrollments)
    time_invested = sum((e.updated_at - e.started_at).total_seconds() / 3600 for e in enrollments)
    
    success_rate = predictor.predict_success_rate(
        completion_rate,
        avg_progress,
        int(time_invested)
    )
    
    return {
        "worker_id": worker_id,
        "success_prediction": success_rate,
        "enrollments": len(enrollments),
        "completed": completed,
        "avg_progress": round(avg_progress, 2),
        "time_invested_hours": round(time_invested, 1),
        "recommendation": "Keep going!" if success_rate > 70 else "Increase engagement"
    }

@router.post("/skill-gap-analysis/{worker_id}")
async def skill_gap_analysis(worker_id: str, target_role: str, db: AsyncSession = Depends(get_db)):
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar()
    
    if not worker:
        return {"error": "Worker not found"}
    
    enroll_result = await db.execute(
        select(Credential).join(
            WorkerCredential,
            WorkerCredential.credential_id == Credential.id
        ).where(
            (WorkerCredential.worker_id == worker_id) &
            (WorkerCredential.status == "completed")
        )
    )
    completed_creds = enroll_result.scalars().all()
    current_skills = set()
    for cred in completed_creds:
        try:
            skills = json.loads(cred.skills_taught or "[]")
            current_skills.update(skills)
        except:
            pass
    
    all_creds_result = await db.execute(select(Credential))
    all_creds = all_creds_result.scalars().all()
    
    required_skills = set()
    for cred in all_creds:
        try:
            skills = json.loads(cred.skills_taught or "[]")
            required_skills.update(skills)
        except:
            pass
    
    skill_gaps = required_skills - current_skills
    mastered_skills = current_skills & required_skills
    
    return {
        "worker_id": worker_id,
        "target_role": target_role,
        "current_skills": list(current_skills),
        "required_skills": list(required_skills),
        "skill_gaps": list(skill_gaps),
        "mastered_skills": list(mastered_skills),
        "readiness_score": round((len(mastered_skills) / len(required_skills)) * 100, 2) if required_skills else 0,
        "recommended_credentials": len(skill_gaps)
    }
