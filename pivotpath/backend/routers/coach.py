from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import uuid, os

from database import get_db, Worker, CoachSession, SkillSignal, Credential
from security import get_current_worker
from vector_store import store_exchange, retrieve_context
from career_graph import find_career_path, get_reachable_roles, all_roles

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

You have access to real-time skills demand data and a career transition graph powered by Dijkstra's algorithm.
When recommending a path, reference the exact steps, weeks, and costs from the career graph data provided.

Format responses in clear, readable prose. Use short paragraphs. Keep responses under 250 words."""


async def call_groq(messages, system):
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "system", "content": system}] + messages,
                "max_tokens": 600,
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
    elif any(w in msg for w in ["path", "route", "transition", "move", "change"]):
        return "I can map out the exact career path from your current role to your target using our skills graph. Each step shows the credentials needed, time required, and cost.\n\nWhat's your current role and where do you want to get to?"
    else:
        return "I'm Alex, your PivotPath AI career coach. I'm here to help you build a clear path to a new in-demand role — with real employer interviews at the end, not just a certificate.\n\nWhat role are you coming from, and what kind of work excites you most?"


async def get_ai_response(messages, worker_context="", rag_context="", graph_context=""):
    system = SYSTEM_PROMPT
    if worker_context:
        system += f"\n\nWorker profile:\n{worker_context}"
    if rag_context:
        system += f"\n\nRelevant past conversations (from memory):\n{rag_context}"
    if graph_context:
        system += f"\n\nCareer path data:\n{graph_context}"
    if GROQ_API_KEY:
        try:
            return await call_groq(messages, system)
        except Exception as e:
            print(f"Groq error: {e}")
    return fallback(messages[-1]["content"])


class ChatMessage(BaseModel):
    worker_id: str = Field(max_length=64)
    message: str = Field(min_length=1, max_length=2000)


@router.post("/chat")
async def chat(
    data: ChatMessage,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    # Fetch worker profile
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

    # RAG — retrieve semantically relevant past exchanges
    rag_docs = retrieve_context(data.worker_id, data.message, k=3)
    rag_context = "\n---\n".join(rag_docs) if rag_docs else ""

    # Career graph context — inject if message mentions transition/path
    graph_context = ""
    path_keywords = ["path", "route", "transition", "move to", "become", "get to", "career change"]
    if worker and any(kw in data.message.lower() for kw in path_keywords):
        if worker.current_role and worker.target_role:
            path = find_career_path(worker.current_role, worker.target_role)
            if path:
                steps_str = " → ".join(path["path"])
                graph_context = (
                    f"Optimal path: {steps_str}\n"
                    f"Total time: {path['total_weeks']} weeks\n"
                    f"Total cost: ${path['total_cost_usd']:,}\n"
                    f"Salary uplift: +${path['salary_uplift']:,}"
                )

    # Build message history (last 6 exchanges)
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

    response = await get_ai_response(messages, worker_context, rag_context, graph_context)

    # Store exchange in DB and vector store
    session = CoachSession(
        id=str(uuid.uuid4()),
        worker_id=data.worker_id,
        message=data.message,
        response=response
    )
    db.add(session)
    await db.commit()

    # Store in vector memory (RAG)
    store_exchange(data.worker_id, data.message, response)

    return {"response": response, "session_id": session.id}


@router.get("/history/{worker_id}")
async def get_history(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CoachSession)
        .where(CoachSession.worker_id == worker_id)
        .order_by(CoachSession.created_at.asc())
    )
    return result.scalars().all()


@router.post("/roadmap/{worker_id}")
async def generate_roadmap(
    worker_id: str,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
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

    # Career graph path
    career_path = None
    if worker.current_role and worker.target_role:
        career_path = find_career_path(worker.current_role, worker.target_role)

    # Reachable roles
    reachable = get_reachable_roles(worker.current_role) if worker.current_role else []

    return {
        "worker_name": worker.name,
        "current_role": worker.current_role,
        "target_role": worker.target_role,
        "career_path": career_path,
        "reachable_roles": reachable[:5],
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
        "estimated_timeline_weeks": career_path["total_weeks"] if career_path else 20,
        "estimated_salary_uplift": career_path["salary_uplift"] if career_path else 22000
    }


@router.get("/career-path")
async def career_path_query(
    from_role: str,
    to_role: str,
    current_worker: Worker = Depends(get_current_worker)
):
    path = find_career_path(from_role, to_role)
    if not path:
        raise HTTPException(status_code=404, detail="No path found between these roles")
    return path


@router.get("/all-roles")
async def list_all_roles(current_worker: Worker = Depends(get_current_worker)):
    return {"roles": all_roles()}


@router.get("/status")
async def ai_status():
    return {
        "groq": bool(GROQ_API_KEY),
        "rag": True,
        "career_graph": True,
        "fallback": True,
        "active_provider": "groq" if GROQ_API_KEY else "fallback"
    }