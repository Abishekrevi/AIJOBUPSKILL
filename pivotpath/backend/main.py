import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import create_tables
from routers import workers, coach, credentials, employers, hr, signal, auth, gigs
from routers import rag, security, deeplearning, notifications, analytics

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

app = FastAPI(
    title="PivotPath API",
    version="0.4.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8000",
    os.getenv("FRONTEND_URL", "https://*.onrender.com")
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router,         prefix="/api/auth",         tags=["Auth"])
app.include_router(workers.router,      prefix="/api/workers",      tags=["Workers"])
app.include_router(coach.router,        prefix="/api/coach",        tags=["AI Coach"])
app.include_router(credentials.router,  prefix="/api/credentials",  tags=["Credentials"])
app.include_router(employers.router,    prefix="/api/employers",    tags=["Employers"])
app.include_router(hr.router,           prefix="/api/hr",           tags=["HR"])
app.include_router(signal.router,       prefix="/api/signal",       tags=["Signal"])
app.include_router(gigs.router,         prefix="/api/gigs",         tags=["Gigs"])
app.include_router(rag.router,          prefix="/api/rag",          tags=["RAG Search"])
app.include_router(security.router,     prefix="/api/security",     tags=["Security"])
app.include_router(deeplearning.router, prefix="/api/dl",           tags=["Deep Learning"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=["Analytics"])

@app.get("/")
async def root():
    return {"message": "PivotPath API v0.4.0", "docs": "/api/docs"}

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "0.4.0"}
