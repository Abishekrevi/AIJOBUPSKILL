"""
PivotPath Coach Router — Production RAG/NLP
Integrates upgrades 11-25 + circuit breaker (46) + event bus (47):
  11-14. Hybrid BM25+vector search, reranker, NER skill extraction, semantic chunking
  15.    Sentiment analysis — emotional state detection
  16.    Query decomposition — multi-hop RAG
  17.    HyDE — cold-start retrieval
  18.    Knowledge graph context injection
  20.    Contextual compression
  21.    Intent classification — specialist routing
  23.    Memory summarisation
  24.    Guardrails — hallucination validation
  25.    Streaming response endpoint
  46.    Circuit breaker on Groq API calls
  47.    Event bus publish after session stored
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
import uuid, os, json

from database import get_db, Worker, CoachSession, SkillSignal, Credential
from security import get_current_worker
from vector_store import (
    store_exchange, hybrid_retrieve, hyde_retrieve,
    get_compressed_history
)
from nlp_pipeline import (
    extract_skills_from_text,
    analyze_sentiment,
    kg_to_context_string, build_knowledge_graph,
    classify_intent, get_intent_system_addition,
    validate_response,
)
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

You have access to:
- Real-time skills demand data with demand scores and salary uplift figures
- A career transition graph powered by A* pathfinding
- The worker's complete conversation history via RAG memory
- A knowledge graph linking skills, credentials, and employers

Format responses in clear, readable prose. Use short paragraphs. Keep responses under 250 words."""


# ─── Upgrade 46: Groq call wrapped in circuit breaker ────────────────────────
async def call_groq(messages: list, system: str) -> str:
    """
    Upgrade 46: Circuit breaker wraps every Groq API call.
    3 consecutive failures → circuit OPEN → fallback used automatically.
    After 60s recovery timeout → HALF_OPEN → probe → CLOSED if successful.
    No more 500 errors cascading to all users when Groq is down.
    """
    from circuit_breaker import groq_breaker
    import httpx

    async def _raw_groq():
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": 600,
                    "temperature": 0.7
                }
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    last_msg = messages[-1]["content"] if messages else ""
    return await groq_breaker.call(
        _raw_groq,
        fallback=lambda: fallback(last_msg)
    )


async def call_groq_stream(messages: list, system: str):
    """Upgrade 25: Streaming response generator (SSE)."""
    import httpx
    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "system", "content": system}] + messages,
                "max_tokens": 600,
                "temperature": 0.7,
                "stream": True
            }
        ) as resp:
            async for line in resp.aiter_lines():
                if line.startswith("data: ") and line != "data: [DONE]":
                    yield line + "\n\n"


def fallback(user_message: str) -> str:
    msg = user_message.lower()
    if any(w in msg for w in ["skill", "learn", "course", "study", "what should"]):
        return "Based on current market data, the three highest-demand skills are AI Product Management (+$25K uplift), Prompt Engineering (+$22K), and Data Analysis with Python (+$18K).\n\nI'd suggest starting with Prompt Engineering — it takes 4-6 weeks and costs under $300. Want me to show the top employer-endorsed credentials?"
    elif any(w in msg for w in ["salary", "pay", "earn", "money"]):
        return "Workers completing a full AI skills pathway see an average salary uplift of $18,000–$28,000 within 12 months. LLM Engineering leads at +$30K avg.\n\nShall I run a personalised projection based on your background?"
    elif any(w in msg for w in ["path", "route", "transition", "move", "change"]):
        return "I can map the optimal career path from your current role to your target using graph algorithms — with exact steps, weeks, and costs.\n\nWhat's your current role and where do you want to go?"
    elif any(w in msg for w in ["scared", "anxious", "hard", "worried", "stressed"]):
        return "What you're feeling is completely normal — career transitions are genuinely hard. But you've already done the hardest part: deciding to move forward.\n\nWhat feels like the biggest obstacle right now?"
    else:
        return "I'm Alex, your PivotPath AI career coach. I'm here to help you build a clear path to a new in-demand role — with real employer interviews at the end.\n\nWhat role are you coming from, and what kind of work excites you most?"


# ─── Upgrade 16: Query decomposition ─────────────────────────────────────────
async def decompose_query(query: str) -> list[str]:
    """Break complex multi-part questions into focused sub-queries."""
    if not GROQ_API_KEY:
        return [query]
    try:
        resp = await call_groq(
            messages=[{"role": "user", "content":
                       f"Break this career question into 2-3 simpler sub-questions (one per line, no numbering):\n{query}"}],
            system="You decompose complex career coaching questions into simpler sub-questions. Return only the sub-questions, one per line."
        )
        sub_qs = [q.strip() for q in resp.strip().split("\n") if q.strip() and len(q) > 5]
        return sub_qs[:3] if sub_qs else [query]
    except Exception:
        return [query]


async def multi_hop_retrieve(worker_id: str, query: str, k: int = 3,
                              use_decomposition: bool = True) -> list[str]:
    """Upgrade 16: Multi-hop retrieval via query decomposition."""
    if not use_decomposition:
        return hybrid_retrieve(worker_id, query, k=k)

    complexity_signals = ["and", "also", "additionally", "as well as", "plus", "while"]
    is_complex = any(s in query.lower() for s in complexity_signals) or len(query) > 120

    if not is_complex:
        return hybrid_retrieve(worker_id, query, k=k)

    sub_queries = await decompose_query(query)
    all_docs = []
    for sq in sub_queries:
        docs = hybrid_retrieve(worker_id, sq, k=k)
        all_docs.extend(docs)

    seen, unique = set(), []
    for doc in all_docs:
        if doc not in seen:
            seen.add(doc)
            unique.append(doc)

    from vector_store import rerank
    return rerank(query, unique, top_n=k)


# ─── Main AI response builder ─────────────────────────────────────────────────
async def get_ai_response(
    messages: list,
    worker_context: str = "",
    rag_context: str = "",
    graph_context: str = "",
    kg_context: str = "",
    intent: str = "GENERAL",
    memory_summary: str = "",
) -> str:
    system = SYSTEM_PROMPT

    intent_addition = get_intent_system_addition(intent)
    if intent_addition:
        system += f"\n\nFor this message specifically: {intent_addition}"
    if worker_context:
        system += f"\n\nWorker profile:\n{worker_context}"
    if memory_summary:
        system += f"\n\nConversation history summary:\n{memory_summary}"
    if rag_context:
        system += f"\n\nRelevant past exchanges (from RAG memory):\n{rag_context}"
    if kg_context:
        system += f"\n\n{kg_context}"
    if graph_context:
        system += f"\n\nCareer path data:\n{graph_context}"

    if GROQ_API_KEY:
        try:
            return await call_groq(messages, system)
        except Exception as e:
            print(f"[Groq] error: {e}")

    return fallback(messages[-1]["content"])


# ─── Request models ───────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    worker_id: str = Field(max_length=64)
    message: str = Field(min_length=1, max_length=2000)


# ─── Main chat endpoint ───────────────────────────────────────────────────────
@router.post("/chat")
async def chat(
    data: ChatMessage,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = result.scalar()
    worker_context = ""
    if worker:
        salary_str = f"${worker.current_salary:,.0f}" if worker.current_salary else "not provided"
        worker_context = (
            f"Name: {worker.name}\nCurrent role: {worker.current_role}\n"
            f"Salary: {salary_str}\nTarget: {worker.target_role or 'not set'}\n"
            f"Skills: {worker.skills_summary or 'not assessed'}\nStatus: {worker.status}"
        )

    # Upgrade 21: Classify intent
    intent = classify_intent(data.message)

    # Upgrade 13: Extract skills from message
    extracted_skills = extract_skills_from_text(data.message)
    if extracted_skills and worker:
        existing = worker.skills_summary or ""
        new_skills = [s for s in extracted_skills if s.lower() not in existing.lower()]
        if new_skills:
            worker.skills_summary = (existing + ", " + ", ".join(new_skills)).strip(", ")
            await db.commit()
            await db.refresh(worker)

    # Upgrade 15: Sentiment analysis
    sentiment = analyze_sentiment(data.message)
    if sentiment.get("distressed"):
        intent = "EMOTIONAL_SUPPORT"

    # Fetch session history
    sessions_result = await db.execute(
        select(CoachSession)
        .where(CoachSession.worker_id == data.worker_id)
        .order_by(CoachSession.created_at.desc())
        .limit(20)
    )
    all_sessions = sessions_result.scalars().all()

    # Upgrade 23: Memory summarisation
    history_data = await get_compressed_history(
        data.worker_id, all_sessions,
        groq_caller=call_groq if GROQ_API_KEY else None
    )
    recent_sessions = history_data["recent"]
    memory_summary = history_data.get("summary") or ""

    messages = []
    for s in reversed(recent_sessions):
        messages.append({"role": "user", "content": s.message})
        messages.append({"role": "assistant", "content": s.response})
    messages.append({"role": "user", "content": data.message})

    # Upgrades 16+17: multi-hop retrieval + HyDE cold-start
    rag_docs = await multi_hop_retrieve(
        data.worker_id, data.message, k=3,
        use_decomposition=len(data.message) > 80
    )
    if not rag_docs:
        rag_docs = await hyde_retrieve(
            data.worker_id, data.message, k=3,
            groq_caller=call_groq if GROQ_API_KEY else None
        )
    rag_context = "\n---\n".join(rag_docs)

    # Upgrade 18: Knowledge graph context
    kg_context = ""
    if worker and worker.target_role:
        kg_context = kg_to_context_string(worker.target_role)
    if not kg_context and extracted_skills:
        kg_context = kg_to_context_string(extracted_skills[0])

    # Career graph context
    graph_context = ""
    path_keywords = ["path", "route", "transition", "move to", "become", "career change", "get to"]
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

    response = await get_ai_response(
        messages, worker_context, rag_context,
        graph_context, kg_context, intent, memory_summary
    )

    # Upgrade 24: Guardrails
    response, is_valid, issues = await validate_response(response, db)
    if not is_valid and issues and GROQ_API_KEY:
        salary_issues = [i for i in issues if "salary" in i.lower()]
        if salary_issues:
            messages[-1]["content"] += " (Please provide accurate salary figures based on current market data.)"
            response = await get_ai_response(
                messages, worker_context, rag_context,
                graph_context, kg_context, intent, memory_summary
            )

    # Store session
    session = CoachSession(
        id=str(uuid.uuid4()),
        worker_id=data.worker_id,
        message=data.message,
        response=response
    )
    db.add(session)
    await db.commit()

    # Store in vector memory
    store_exchange(data.worker_id, data.message, response)

    # ── Upgrade 47: Publish coaching event to async event bus ────────────────
    try:
        from circuit_breaker import bus, AppEvent
        await bus.publish(AppEvent.CREDENTIAL_COMPLETED, {
            "worker_id": data.worker_id,
            "event": "coach_session_completed",
            "intent": intent,
        })
    except Exception:
        pass

    return {
        "response": response,
        "session_id": session.id,
        "intent": intent,
        "sentiment": sentiment.get("label", "NEUTRAL"),
        "skills_extracted": extracted_skills,
        "rag_docs_used": len(rag_docs),
        "validation_passed": is_valid,
    }


# ─── Upgrade 25: Streaming chat endpoint ─────────────────────────────────────
@router.post("/chat/stream")
async def chat_stream(
    data: ChatMessage,
    current_worker: Worker = Depends(get_current_worker),
    db: AsyncSession = Depends(get_db)
):
    """Server-Sent Events streaming — tokens appear word-by-word like ChatGPT."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Streaming requires GROQ_API_KEY")

    result = await db.execute(select(Worker).where(Worker.id == data.worker_id))
    worker = result.scalar()
    worker_context = ""
    if worker:
        salary_str = f"${worker.current_salary:,.0f}" if worker.current_salary else "not provided"
        worker_context = (
            f"Name: {worker.name}\nCurrent role: {worker.current_role}\n"
            f"Target: {worker.target_role or 'not set'}\nStatus: {worker.status}"
        )

    intent = classify_intent(data.message)
    rag_docs = hybrid_retrieve(data.worker_id, data.message, k=3)
    rag_context = "\n---\n".join(rag_docs)

    system = SYSTEM_PROMPT
    intent_add = get_intent_system_addition(intent)
    if intent_add:
        system += f"\n\nFor this message: {intent_add}"
    if worker_context:
        system += f"\n\nWorker profile:\n{worker_context}"
    if rag_context:
        system += f"\n\nRelevant context:\n{rag_context}"

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

    return StreamingResponse(
        call_groq_stream(messages, system),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


# ─── Init KG on startup ───────────────────────────────────────────────────────
async def init_knowledge_graph(db: AsyncSession):
    """Build the knowledge graph from DB data at startup."""
    try:
        signals_r = await db.execute(select(SkillSignal))
        creds_r = await db.execute(select(Credential))
        from database import Employer
        emp_r = await db.execute(select(Employer))
        build_knowledge_graph(
            signals_r.scalars().all(),
            creds_r.scalars().all(),
            emp_r.scalars().all()
        )
        print("[KG] Knowledge graph built successfully")
    except Exception as e:
        print(f"[KG] init error: {e}")


# ─── Supporting endpoints ─────────────────────────────────────────────────────
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
    career_path = None
    if worker.current_role and worker.target_role:
        career_path = find_career_path(worker.current_role, worker.target_role)
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
    from circuit_breaker import groq_breaker
    return {
        "groq": bool(GROQ_API_KEY),
        "rag": True,
        "hybrid_search": True,
        "reranker": True,
        "intent_classification": True,
        "sentiment_analysis": True,
        "knowledge_graph": True,
        "hyde": True,
        "guardrails": True,
        "streaming": True,
        "career_graph": True,
        "circuit_breaker": groq_breaker.state.value,
        "active_provider": "groq" if GROQ_API_KEY else "fallback"
    }
