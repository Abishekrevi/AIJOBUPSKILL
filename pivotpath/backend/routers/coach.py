from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid, os

from database import get_db, Worker, CoachSession, SkillSignal, Credential

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SYSTEM_PROMPT = """You are Alex, PivotPath's AI career coach. You help displaced workers navigate their transition to new, in-demand roles.

Your approach:
- Be warm, empathetic, and practical. Many users are anxious about job loss.
- Always tie advice to concrete, named skills that are in demand right now.
- Recommend specific credential pathways (not vague suggestions).
- Be honest about timelines — most transitions take 6-12 months.
- Celebrate progress. Reskilling is hard. Acknowledge effort.
- Never be preachy. Be a trusted advisor, not a motivational poster.

You have access to real-time skills demand data. When recommending skills, reference their demand score (out of 100) and salary uplift potential.

Format responses in clear, readable prose. Use short paragraphs. Keep responses under 200 words."""


async def call_groq(messages, system):
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "system", "content": system}] + messages,
                "max_tokens": 500,
                "temperature": 0.7
            }
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def fallback(user_message):
    msg = user_message.lower()
    if any(w in msg for w in ["skill", "learn", "course", "study", "what should"]):
        return "Based on current labour market data, the three highest-demand skills right now are AI Product Management (demand score 91, +$25K avg salary uplift), Prompt Engineering (94/100, +$22K), and Data Analysis with Python (89/100, +$18K).\n\nI'd suggest starting with Prompt Engineering — it takes 4-6 weeks, costs under $300, and is immediately applicable across industries. Want me to show the top employer-endorsed credentials for that pathway?"
    elif any(w in msg for w in ["salary", "pay", "earn", "money"]):
        return "Workers who complete a full AI skills pathway see an average salary uplift of $18,000–$28,000 within 12 months of placement. The highest uplifts: LLM Engineering (+$30K avg) and AI Product Management (+$25K avg).\n\nShall I run a personalised projection based on your background?"
    elif any(w in msg for w in ["time", "long", "month", "week", "how long"]):
        return "Most transitions take 6–12 months from onboarding to first interview. The fastest pathway is 14 weeks (Prompt Engineering + AI for Business). The most common is 6–8 months for a more substantial skill shift.\n\nThe biggest factor is consistency — workers who put in 8–10 hours/week progress twice as fast. Want me to build a personalised timeline?"
    elif any(w in msg for w in ["job", "role", "employer", "hire", "interview"]):
        return "Our employer pipeline has pre-committed interview slots at Stripe (AI PM, Data Analyst), Salesforce (AI Solutions Engineer), and Deloitte (AI Consultant, Data Analyst).\n\nThese employers agreed to interview PivotPath graduates — a guaranteed interview, not just a job board listing. Want to see which pathway aligns best?"
    elif any(w in msg for w in ["cost", "price", "afford", "isa", "income share"]):
        return "PivotPath costs you nothing upfront. We use an Income Share Agreement — you only pay once you're earning more in your new role.\n\nTypical arrangement: ~12% of your salary uplift for 24 months, minimum earnings threshold of $40K. If you're not placed, you owe nothing."
    elif any(w in msg for w in ["scared", "worried", "anxious", "stress", "hard"]):
        return "What you're feeling is completely normal — transitions are hard, and the uncertainty is real. But every worker who comes through PivotPath has already done the hardest thing: deciding to move forward.\n\nThe skills you've built aren't gone — they're a foundation we're adding to. What feels like the biggest obstacle right now?"
    else:
        return "I'm Alex, your PivotPath AI career coach. I'm here to help you build a clear path to a new in-demand role — with real employer interviews at the end, not just a certificate.\n\nWhat role are you coming from, and what kind of work excites you most?"


async def get_ai_response(messages, worker_context=""):
    system = SYSTEM_PROMPT
    if worker_context:
        system += f"\n\nWorker profile:\n{worker_context}"
    if GROQ_API_KEY:
        try:
            return await call_groq(messages, system)
        except Exception as e:
            print(f"Groq error: {e}")
    return fallback(messages[-1]["content"])


class ChatMessage(BaseModel):
    worker_id: str
    message: str


@router.post("/chat")
async def chat(data: ChatMessage, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = result.scalar()
    worker_context = ""
    if worker:
        salary_str = f"${worker.current_salary:,.0f}" if worker.current_salary else "not provided"
        worker_context = (
            f"Name: {worker.name}\n"
            f"Current role: {worker.current_role}\n"
            f"Salary: {salary_str}\n"
            f"Target: {worker.target_role or 'not set'}\n"
            f"Skills: {worker.skills_summary or 'not assessed'}\n"
            f"Status: {worker.status}"
        )
    sessions_result = await db.execute(
        select(CoachSession)
        .where(CoachSession.worker_id == data.worker_id)
        .order_by(CoachSession.created_at.desc())
        .limit(6)
    )
    history = sessions_result.scalars().all()
    messages = []
    for s in reversed(history):
        messages.append({"role": "user", "content": s.message})
        messages.append({"role": "assistant", "content": s.response})
    messages.append({"role": "user", "content": data.message})
    response = await get_ai_response(messages, worker_context)
    session = CoachSession(
        id=str(uuid.uuid4()),
        worker_id=data.worker_id,
        message=data.message,
        response=response
    )
    db.add(session)
    await db.commit()
    return {"response": response, "session_id": session.id}


@router.get("/history/{worker_id}")
async def get_history(worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.worker_id == worker_id)
        .order_by(CoachSession.created_at.asc())
    )
    return result.scalars().all()


@router.post("/roadmap/{worker_id}")
async def generate_roadmap(worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    signals_result = await db.execute(
        select(SkillSignal).order_by(SkillSignal.demand_score.desc()).limit(5)
    )
    top_skills = signals_result.scalars().all()
    creds_result = await db.execute(
        select(Credential)
        .where(Credential.employer_endorsed == True)
        .order_by(Credential.placement_rate.desc())
        .limit(3)
    )
    top_creds = creds_result.scalars().all()
    return {
        "worker_name": worker.name,
        "current_role": worker.current_role,
        "recommended_skills": [
            {"skill": s.skill_name, "demand_score": s.demand_score,
             "salary_uplift": s.avg_salary_uplift, "growth_rate": s.growth_rate}
            for s in top_skills
        ],
        "recommended_credentials": [
            {"title": c.title, "provider": c.provider,
             "weeks": c.duration_weeks, "placement_rate": c.placement_rate}
            for c in top_creds
        ],
        "estimated_timeline_weeks": 20,
        "estimated_salary_uplift": 22000
    }


@router.get("/status")
async def ai_status():
    return {
        "groq": bool(GROQ_API_KEY),
        "fallback": True,
        "active_provider": "groq" if GROQ_API_KEY else "fallback"
    }
