from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
from datetime import datetime

from database import get_db, Credential, Worker, WorkerCredential

router = APIRouter()

def calculate_similarity(text1: str, text2: str) -> float:
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    return intersection / union if union > 0 else 0.0

@router.post("/search-credentials")
async def search_credentials_rag(query: str, worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Credential).order_by(Credential.demand_score.desc()))
    all_creds = result.scalars().all()
    
    scored_creds = []
    for cred in all_creds:
        similarity = calculate_similarity(query, f"{cred.title} {cred.description}")
        if similarity > 0.1:
            scored_creds.append({
                'credential': cred,
                'score': similarity,
                'demand_score': cred.demand_score
            })
    
    scored_creds.sort(key=lambda x: x['score'] * 0.6 + (x['demand_score'] / 100) * 0.4, reverse=True)
    
    worker_result = await db.execute(
        select(WorkerCredential).where(WorkerCredential.worker_id == worker_id)
    )
    enrolled_ids = {e.credential_id for e in worker_result.scalars().all()}
    
    recommendations = []
    for item in scored_creds[:5]:
        cred = item['credential']
        if cred.id not in enrolled_ids:
            d = {k: v for k, v in cred.__dict__.items() if not k.startswith("_")}
            try:
                d["skills_taught"] = json.loads(cred.skills_taught or "[]")
            except:
                d["skills_taught"] = []
            d["relevance_score"] = round(item['score'], 2)
            recommendations.append(d)
    
    return {
        "query": query,
        "recommendations": recommendations,
        "count": len(recommendations)
    }

@router.get("/learning-path/{worker_id}")
async def generate_learning_path(worker_id: str, db: AsyncSession = Depends(get_db)):
    worker_result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = worker_result.scalar()
    if not worker:
        return {"error": "Worker not found"}
    
    enroll_result = await db.execute(
        select(WorkerCredential, Credential)
        .join(Credential, WorkerCredential.credential_id == Credential.id)
        .where(WorkerCredential.worker_id == worker_id)
        .order_by(WorkerCredential.started_at)
    )
    enrolled = enroll_result.all()
    
    cred_result = await db.execute(select(Credential).order_by(Credential.demand_score.desc()))
    all_creds = cred_result.scalars().all()
    
    enrolled_ids = {e[1].id for e in enrolled}
    current_skills = set()
    for _, cred in enrolled:
        try:
            skills = json.loads(cred.skills_taught or "[]")
            current_skills.update(skills)
        except:
            pass
    
    next_creds = []
    for cred in all_creds:
        if cred.id not in enrolled_ids:
            try:
                skills = json.loads(cred.skills_taught or "[]")
                matches = len(set(skills) & current_skills)
                if matches > 0 or len(next_creds) < 3:
                    next_creds.append({
                        'id': cred.id,
                        'title': cred.title,
                        'skills': skills,
                        'demand_score': cred.demand_score,
                        'matches': matches
                    })
            except:
                pass
    
    next_creds.sort(key=lambda x: (x['matches'], x['demand_score']), reverse=True)
    
    return {
        "worker_id": worker_id,
        "current_role": worker.current_role,
        "current_skills": list(current_skills),
        "enrolled_count": len(enrolled),
        "progress_avg": worker.progress_pct,
        "recommended_next": next_creds[:5]
    }
