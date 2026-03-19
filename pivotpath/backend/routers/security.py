from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import hashlib
import secrets
import jwt
from pydantic import BaseModel

from database import get_db, Worker

router = APIRouter()

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRY = 24

class PasswordChange(BaseModel):
    old_password: str
    new_password: str

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${pwdhash.hex()}"

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        salt, pwdhash = stored_hash.split('$')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return new_hash.hex() == pwdhash
    except:
        return False

def generate_token(worker_id: str) -> str:
    payload = {
        'worker_id': worker_id,
        'exp': datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/change-password")
async def change_password(data: PasswordChange, worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar()
    
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    if not verify_password(worker.password_hash, data.old_password):
        raise HTTPException(status_code=401, detail="Invalid current password")
    
    worker.password_hash = hash_password(data.new_password)
    worker.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"success": True, "message": "Password changed successfully"}

@router.get("/security-audit/{worker_id}")
async def security_audit(worker_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Worker).where(Worker.id == worker_id))
    worker = result.scalar()
    
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    
    checks = {
        "password_set": bool(worker.password_hash),
        "email_verified": worker.email_verified if hasattr(worker, 'email_verified') else False,
        "account_age_days": (datetime.utcnow() - worker.created_at).days,
        "last_login": worker.last_login if hasattr(worker, 'last_login') else None,
        "two_factor_enabled": False,
        "compliance_score": 85
    }
    
    return {
        "worker_id": worker_id,
        "security_checks": checks,
        "risks": ["Enable 2FA", "Update password"]
    }
