from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from datetime import datetime, timedelta
import jwt, os

from database import get_db, Worker, HRCompany

SECRET_KEY = os.getenv("SECRET_KEY", "pivotpath-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_token(subject: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": subject, "role": role, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_worker(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> Worker:
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "worker":
        raise HTTPException(status_code=403, detail="Worker access only")
    result = await db.execute(select(Worker).where(Worker.id == payload["sub"]))
    worker = result.scalar()
    if not worker:
        raise HTTPException(status_code=401, detail="Account not found")
    return worker

async def get_current_hr(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> HRCompany:
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "hr":
        raise HTTPException(status_code=403, detail="HR access only")
    result = await db.execute(select(HRCompany).where(HRCompany.id == payload["sub"]))
    company = result.scalar()
    if not company:
        raise HTTPException(status_code=401, detail="HR account not found")
    return company