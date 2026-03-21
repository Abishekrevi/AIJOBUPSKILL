"""
PivotPath main.py — Production Grade
Implements:
  7. SQL injection scanner middleware
  8. Content Security Policy headers
  + all existing security middleware
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

from database import create_tables
from routers import workers, coach, credentials, employers, hr, signal, auth, gigs
import audit_router

ALLOWED_ORIGINS = [
    "https://pivotpath-app.onrender.com",
    "http://localhost:3000",
]

active_connections: Dict[str, WebSocket] = {}
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ─── Upgrade 7: SQL injection patterns ───────────────────────────────────────
SQL_INJECTION_PATTERNS = [
    r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|TRUNCATE|EXEC)\b)",
    r"(--|#|/\*|\*/)",
    r"(\bOR\b\s+[\w'\"]+\s*=\s*[\w'\"]+)",
    r"(\bAND\b\s+[\w'\"]+\s*=\s*[\w'\"]+\s*--)",
    r"(;\s*(DROP|ALTER|INSERT|UPDATE|DELETE))",
    r"(\bXP_\w+\b)",
    r"(\bSLEEP\s*\(|\bWAITFOR\b)",
    r"(CHAR\s*\(\s*\d+\s*\))",
]
SQL_REGEX = re.compile("|".join(SQL_INJECTION_PATTERNS), re.IGNORECASE)

SAFE_PATHS = {"/api/auth/worker/login", "/api/auth/hr/login",
              "/api/workers/", "/health", "/"}

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

app = FastAPI(
    title="PivotPath API",
    version="0.4.0",
    lifespan=lifespan,
    docs_url=None,      # disable Swagger in production
    redoc_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS — locked to frontend only
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ─── Upgrade 7: SQL injection guard ──────────────────────────────────────────
@app.middleware("http")
async def sql_injection_guard(request: Request, call_next):
    if request.method in ("POST", "PATCH", "PUT"):
        try:
            body = await request.body()
            text = body.decode("utf-8", errors="ignore")
            if SQL_REGEX.search(text):
                # Log attempt (fire-and-forget)
                client_ip = request.client.host if request.client else "unknown"
                print(f"[SECURITY] SQL injection attempt from {client_ip}: {text[:100]}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid request payload"}
                )
        except Exception:
            pass
    return await call_next(request)

# ─── Upgrade 8: Security headers (full suite) ────────────────────────────────
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Legacy XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Force HTTPS for 1 year
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    # Limit referrer info
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Disable unnecessary browser features
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), "
        "payment=(), usb=(), magnetometer=(), gyroscope=()"
    )
    # Upgrade 8: Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "connect-src 'self' "
        "https://api.groq.com "
        "wss://pivotpath-api.onrender.com "
        "https://pivotpath-api.onrender.com; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    # Remove server fingerprint
    response.headers.pop("server", None)
    response.headers.pop("x-powered-by", None)

    return response

# Routers
app.include_router(auth.router,              prefix="/api/auth",        tags=["Auth"])
app.include_router(workers.router,           prefix="/api/workers",     tags=["Workers"])
app.include_router(coach.router,             prefix="/api/coach",       tags=["AI Coach"])
app.include_router(credentials.router,       prefix="/api/credentials", tags=["Credentials"])
app.include_router(employers.router,         prefix="/api/employers",   tags=["Employers"])
app.include_router(hr.router,                prefix="/api/hr",          tags=["HR"])
app.include_router(signal.router,            prefix="/api/signal",      tags=["Signal"])
app.include_router(gigs.router,              prefix="/api/gigs",        tags=["Gigs"])
app.include_router(audit_router.router,      prefix="/api/audit",       tags=["Audit"])

# ─── WebSocket notifications ──────────────────────────────────────────────────
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

@app.get("/")
async def root():
    return {"message": "PivotPath API v0.4.0"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_connections": len(active_connections),
        "version": "0.4.0",
    }