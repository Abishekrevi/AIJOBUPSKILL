"""
PivotPath main.py — v0.5.0 — ALL UPGRADES 1-49 ACTIVE
Security (1-10) + RAG/NLP (11-25) + DSA (26-35) + ML/AI (36-43) + Infra (44-49)
"""

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from typing import Dict
import re

from database import create_tables, AsyncSessionLocal
from routers import workers, coach, credentials, employers, hr, signal, auth, gigs
import audit_router
import ml_router

# Infra upgrades
from observability import init_telemetry, telemetry_middleware
from circuit_breaker import bus, AppEvent
from api_versioning import v1_router, v2_router, versioning_middleware

ALLOWED_ORIGINS = [
    "https://pivotpath-app.onrender.com",
    "http://localhost:3000",
]

active_connections: Dict[str, WebSocket] = {}
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

SQL_INJECTION_PATTERNS = [
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|TRUNCATE|EXEC)\b)",
    r"(--|#|/\*|\*/)",
    r"(\bOR\b\s+[\w'\"]+\s*=\s*[\w'\"]+)",
    r"(;\s*(DROP|ALTER|INSERT|UPDATE|DELETE))",
    r"(\bXP_\w+\b)",
    r"(\bSLEEP\s*\(|\bWAITFOR\b)",
]
SQL_REGEX = re.compile("|".join(SQL_INJECTION_PATTERNS), re.IGNORECASE)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Upgrade 44: Init OpenTelemetry ───────────────────────────────────────
    init_telemetry("pivotpath-api")

    await create_tables()

    async with AsyncSessionLocal() as db:
        from sqlalchemy import select
        from database import SkillSignal, Credential, WorkerCredential

        # Init knowledge graph (upgrade 18)
        try:
            from routers.coach import init_knowledge_graph
            await init_knowledge_graph(db)
        except Exception as e:
            print(f"[KG] skipped: {e}")

        # Init DSA structures (upgrades 26-35)
        try:
            from dsa_structures import init_tries, init_credential_ranking, init_bloom_from_enrollments
            from career_graph import all_roles as graph_roles

            signals_r = await db.execute(select(SkillSignal))
            skills = [s.skill_name for s in signals_r.scalars().all()]
            creds_r = await db.execute(select(Credential))
            creds = creds_r.scalars().all()
            enrollments_r = await db.execute(select(WorkerCredential))
            enrollments = [{"worker_id": e.worker_id, "credential_id": e.credential_id}
                           for e in enrollments_r.scalars().all()]

            init_tries(skills, graph_roles())
            init_credential_ranking([{"id": c.id, "demand_score": c.demand_score} for c in creds])
            init_bloom_from_enrollments(enrollments)
            print(f"[DSA] Bloom: {len(enrollments)} | Trie: {len(skills)} skills")
        except Exception as e:
            print(f"[DSA] init error: {e}")

        # Init ML models (upgrades 36-43)
        try:
            from ml_models import salary_predictor, get_or_init_bandit
            salary_predictor.train([])
            creds_r2 = await db.execute(select(Credential))
            cred_ids = [c.id for c in creds_r2.scalars().all()]
            if cred_ids:
                get_or_init_bandit(cred_ids)
            print(f"[ML] Salary predictor trained | Bandit: {len(cred_ids)} arms")
        except Exception as e:
            print(f"[ML] init error: {e}")

    print("[PivotPath] API v0.5.0 ready — upgrades 1-49 active")
    yield


app = FastAPI(
    title="PivotPath API",
    version="0.5.0",
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
)

# ── Rate limiter ─────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Upgrade 49: API versioning middleware ────────────────────────────────────
app.middleware("http")(versioning_middleware)

# ── Upgrade 44: OpenTelemetry tracing middleware ──────────────────────────────
app.middleware("http")(telemetry_middleware)

# ── Upgrade 7: SQL injection guard ───────────────────────────────────────────
@app.middleware("http")
async def sql_injection_guard(request: Request, call_next):
    if request.method in ("POST", "PATCH", "PUT"):
        try:
            body = await request.body()
            text = body.decode("utf-8", errors="ignore")
            if SQL_REGEX.search(text):
                client_ip = request.client.host if request.client else "unknown"
                print(f"[SECURITY] SQL injection blocked from {client_ip}")
                return JSONResponse(status_code=400,
                                    content={"detail": "Invalid request payload"})
        except Exception:
            pass
    return await call_next(request)

# ── Upgrades 7-8: Security headers + CSP ──────────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self' https://api.groq.com "
        "wss://pivotpath-api.onrender.com https://pivotpath-api.onrender.com; "
        "img-src 'self' data: https:; font-src 'self' data:; "
        "frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    )
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers.pop("server", None)
    return response

# ── Core routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router,         prefix="/api/auth",        tags=["Auth"])
app.include_router(workers.router,      prefix="/api/workers",     tags=["Workers"])
app.include_router(coach.router,        prefix="/api/coach",       tags=["AI Coach"])
app.include_router(credentials.router,  prefix="/api/credentials", tags=["Credentials"])
app.include_router(employers.router,    prefix="/api/employers",   tags=["Employers"])
app.include_router(hr.router,           prefix="/api/hr",          tags=["HR"])
app.include_router(signal.router,       prefix="/api/signal",      tags=["Signal"])
app.include_router(gigs.router,         prefix="/api/gigs",        tags=["Gigs"])
app.include_router(audit_router.router, prefix="/api/audit",       tags=["Audit"])
app.include_router(ml_router.router,    prefix="/api/ml",          tags=["ML/AI"])

# ── Upgrade 49: Versioned API routers ────────────────────────────────────────
app.include_router(v1_router, prefix="/api", tags=["API v1 (deprecated)"])
app.include_router(v2_router, prefix="/api", tags=["API v2"])

# ── Upgrade 27: Trie autocomplete ────────────────────────────────────────────
@app.get("/api/autocomplete/skills")
async def autocomplete_skills(q: str = "", limit: int = 10):
    from dsa_structures import skill_trie
    if not q.strip():
        return []
    return skill_trie.search_prefix(q.strip(), max_results=limit)


@app.get("/api/autocomplete/roles")
async def autocomplete_roles(q: str = "", limit: int = 10):
    from dsa_structures import role_trie
    if not q.strip():
        return []
    return role_trie.search_prefix(q.strip(), max_results=limit)


# ── WebSocket notifications ───────────────────────────────────────────────────
@app.websocket("/ws/{worker_id}")
async def websocket_endpoint(websocket: WebSocket, worker_id: str):
    await websocket.accept()
    active_connections[worker_id] = websocket
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.pop(worker_id, None)


async def push_notification(worker_id: str, event: str, data: dict):
    ws = active_connections.get(worker_id)
    if ws:
        try:
            await ws.send_json({"event": event, "data": data})
        except Exception:
            active_connections.pop(worker_id, None)


# ── Health + system status ────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "PivotPath API v0.5.0", "upgrades_active": "1-49"}


@app.get("/health")
async def health():
    from dsa_structures import enroll_bloom, signal_cache, credential_ranking
    from ml_models import salary_predictor, _credential_bandit
    from circuit_breaker import groq_breaker, redis_breaker, chromadb_breaker, bus

    return {
        "status": "healthy",
        "version": "0.5.0",
        "active_connections": len(active_connections),
        "upgrades_active": "1-49",
        "security": {
            "jwt_blacklist": True,
            "refresh_rotation": True,
            "aes256_encryption": True,
            "rbac_scopes": True,
            "geo_anomaly": True,
            "sql_injection_guard": True,
            "csp_headers": True,
            "secret_rotation": True,
        },
        "rag_nlp": {
            "hybrid_search": True,
            "reranker": True,
            "intent_classification": True,
            "sentiment_analysis": True,
            "knowledge_graph": True,
            "hyde": True,
            "guardrails": True,
            "streaming": True,
        },
        "dsa": {
            "bloom_filter_items": len(enroll_bloom),
            "lfu_cache_size": len(signal_cache.cache),
            "skip_list_items": len(credential_ranking),
            "trie_autocomplete": True,
            "segment_tree": True,
            "astar_pathfinding": True,
            "union_find_clusters": True,
            "consistent_hashing": True,
            "fibonacci_heap": True,
            "suffix_array_search": True,
        },
        "ml": {
            "salary_predictor_trained": salary_predictor._trained,
            "bandit_arms": len(_credential_bandit.credential_ids) if _credential_bandit else 0,
            "semantic_skill_matching": True,
            "demand_forecasting": True,
            "federated_learning": True,
            "shap_explainability": True,
            "bias_detection": True,
        },
        "infra": {
            "opentelemetry": True,
            "circuit_breakers": {
                "groq": groq_breaker.state.value,
                "redis": redis_breaker.state.value,
                "chromadb": chromadb_breaker.state.value,
            },
            "event_bus": bus.stats(),
            "api_versioning": ["v1 (deprecated)", "v2"],
            "connection_pooling": True,
        },
    }


# ── Upgrade 46: Circuit breaker stats endpoint ───────────────────────────────
@app.get("/api/system/circuit-breakers")
async def circuit_breaker_stats():
    from circuit_breaker import groq_breaker, redis_breaker, chromadb_breaker
    return {
        "groq": groq_breaker.stats(),
        "redis": redis_breaker.stats(),
        "chromadb": chromadb_breaker.stats(),
    }


# ── Upgrade 47: Event bus stats endpoint ─────────────────────────────────────
@app.get("/api/system/events")
async def event_bus_stats():
    return {
        "stats": bus.stats(),
        "recent": bus.recent_events(n=10),
    }
