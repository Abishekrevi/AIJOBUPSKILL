from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from typing import Dict
import json

from database import create_tables
from routers import workers, coach, credentials, employers, hr, signal, auth, gigs

ALLOWED_ORIGINS = [
    "https://pivotpath-app.onrender.com",
    "http://localhost:3000",
]

# Active WebSocket connections: worker_id → WebSocket
active_connections: Dict[str, WebSocket] = {}

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

app = FastAPI(title="PivotPath API", version="0.3.0", lifespan=lifespan)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Security headers
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# Routers
app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(workers.router,     prefix="/api/workers",     tags=["Workers"])
app.include_router(coach.router,       prefix="/api/coach",       tags=["AI Coach"])
app.include_router(credentials.router, prefix="/api/credentials", tags=["Credentials"])
app.include_router(employers.router,   prefix="/api/employers",   tags=["Employers"])
app.include_router(hr.router,          prefix="/api/hr",          tags=["HR"])
app.include_router(signal.router,      prefix="/api/signal",      tags=["Signal"])
app.include_router(gigs.router,        prefix="/api/gigs",        tags=["Gigs"])

# WebSocket — real-time notifications
@app.websocket("/ws/{worker_id}")
async def websocket_endpoint(websocket: WebSocket, worker_id: str):
    await websocket.accept()
    active_connections[worker_id] = websocket
    try:
        while True:
            # Keep connection alive, receive pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        active_connections.pop(worker_id, None)

async def push_notification(worker_id: str, event: str, data: dict):
    """Push a real-time notification to a connected worker."""
    ws = active_connections.get(worker_id)
    if ws:
        try:
            await ws.send_json({"event": event, "data": data})
        except Exception:
            active_connections.pop(worker_id, None)

@app.get("/")
async def root(): return {"message": "PivotPath API v0.3.0"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "active_connections": len(active_connections),
        "version": "0.3.0"
    }