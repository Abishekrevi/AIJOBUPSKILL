from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from database import create_tables
from routers import workers, coach, credentials, employers, hr, signal, auth, gigs

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

app = FastAPI(title="PivotPath API", version="0.2.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router,        prefix="/api/auth",        tags=["Auth"])
app.include_router(workers.router,     prefix="/api/workers",     tags=["Workers"])
app.include_router(coach.router,       prefix="/api/coach",       tags=["AI Coach"])
app.include_router(credentials.router, prefix="/api/credentials", tags=["Credentials"])
app.include_router(employers.router,   prefix="/api/employers",   tags=["Employers"])
app.include_router(hr.router,          prefix="/api/hr",          tags=["HR"])
app.include_router(signal.router,      prefix="/api/signal",      tags=["Signal"])
app.include_router(gigs.router,        prefix="/api/gigs",        tags=["Gigs"])

@app.get("/")
async def root(): return {"message": "PivotPath API v0.2.0"}

@app.get("/health")
async def health(): return {"status": "healthy"}
