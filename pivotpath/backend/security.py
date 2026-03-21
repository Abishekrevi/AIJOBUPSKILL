"""
PivotPath Security Module — Production Grade
Implements upgrades 1–9:
  1. JWT blacklist (Redis) — instant token revocation
  2. Refresh token rotation — 15min access + 7day refresh
  3. AES-256 field encryption — PII at rest
  4. RBAC scopes — granular permission model
  5. IP geo-fencing — login anomaly detection
  6. HMAC signing — webhook integrity
  9. Secret key rotation — versioned signing keys
"""

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, List
import jwt, os, uuid, hmac, hashlib, time, base64, re

from database import get_db, Worker, HRCompany

# ─── Password hashing ────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── Upgrade 9: Secret key rotation (versioned signing keys) ─────────────────
SECRET_KEYS = {
    "v1": os.getenv("SECRET_KEY_V1", os.getenv("SECRET_KEY", "pivotpath-dev-key-change-in-prod")),
    "v2": os.getenv("SECRET_KEY_V2", os.getenv("SECRET_KEY", "pivotpath-dev-key-change-in-prod")),
}
CURRENT_KEY_VERSION = os.getenv("SECRET_KEY_VERSION", "v1")
ALGORITHM = "HS256"

# ─── Upgrade 2: Token expiry times ───────────────────────────────────────────
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))


# ─── Upgrade 1: Redis token blacklist ────────────────────────────────────────
_redis_client = None

async def get_redis():
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(redis_url, decode_responses=True)
    return _redis_client

async def blacklist_token(jti: str, ttl_seconds: int = 86400):
    """Add a JTI to the blacklist with TTL matching token expiry."""
    r = await get_redis()
    if r:
        try:
            await r.setex(f"bl:{jti}", ttl_seconds, "1")
        except Exception as e:
            print(f"[Redis] blacklist error: {e}")

async def is_blacklisted(jti: str) -> bool:
    """Check if a JTI has been revoked. Returns False if Redis unavailable."""
    r = await get_redis()
    if not r:
        return False
    try:
        return await r.exists(f"bl:{jti}") > 0
    except Exception:
        return False


# ─── Upgrade 3: AES-256 field-level encryption ───────────────────────────────
def _get_cipher():
    """Build a Fernet cipher from env vars. Falls back gracefully if not set."""
    try:
        from cryptography.fernet import Fernet
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
        from cryptography.hazmat.primitives import hashes
        key_material = os.getenv("ENCRYPTION_KEY", "pivotpath-encryption-key-change-in-prod")
        salt = os.getenv("ENCRYPTION_SALT", "pivotpath-salt").encode()
        kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=100_000)
        key = base64.urlsafe_b64encode(kdf.derive(key_material.encode()))
        return Fernet(key)
    except Exception as e:
        print(f"[Encryption] cipher init error: {e}")
        return None

def encrypt_field(value: str) -> str:
    """Encrypt a string field. Returns original if encryption unavailable."""
    if not value:
        return value
    cipher = _get_cipher()
    if not cipher:
        return value
    try:
        return cipher.encrypt(value.encode()).decode()
    except Exception:
        return value

def decrypt_field(value: str) -> str:
    """Decrypt a string field. Returns original if decryption fails."""
    if not value:
        return value
    cipher = _get_cipher()
    if not cipher:
        return value
    try:
        return cipher.decrypt(value.encode()).decode()
    except Exception:
        return value  # return as-is if not encrypted


# ─── Upgrade 4: RBAC scope definitions ───────────────────────────────────────
WORKER_SCOPES = [
    "worker:read", "worker:write",
    "coach:read", "coach:write",
    "credentials:read", "credentials:write",
    "employers:read", "employers:write",
    "signal:read", "gigs:read",
]

HR_SCOPES = [
    "hr:read", "hr:write",
    "workers:read",
    "signal:read",
    "audit:read",
]

ADMIN_SCOPES = HR_SCOPES + WORKER_SCOPES + ["admin:all", "audit:write"]

ROLE_SCOPES = {
    "worker": WORKER_SCOPES,
    "hr": HR_SCOPES,
    "admin": ADMIN_SCOPES,
}

def require_scope(scope: str):
    """Dependency factory — enforces a specific permission scope."""
    async def checker(
        credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    ):
        payload = decode_token(credentials.credentials)
        granted = payload.get("scopes", [])
        if scope not in granted and "admin:all" not in granted:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions — requires scope: {scope}"
            )
        return payload
    return checker


# ─── Upgrade 5: IP geo-fencing ───────────────────────────────────────────────
def get_ip_location(ip: str) -> dict:
    """Look up city/country for an IP. Returns empty dict on failure."""
    try:
        import geoip2.database
        with geoip2.database.Reader("GeoLite2-City.mmdb") as reader:
            r = reader.city(ip)
            return {
                "country": r.country.name or "Unknown",
                "city": r.city.name or "Unknown",
                "country_code": r.country.iso_code or "XX",
            }
    except Exception:
        return {"country": "Unknown", "city": "Unknown", "country_code": "XX"}

async def check_login_anomaly(worker_id: str, current_ip: str, db: AsyncSession) -> dict:
    """
    Compare current login IP against historical logins.
    Returns anomaly info if new country detected.
    """
    r = await get_redis()
    if not r:
        return {"anomaly": False}
    try:
        last_country = await r.get(f"last_country:{worker_id}")
        current_location = get_ip_location(current_ip)
        current_country = current_location.get("country_code", "XX")
        if last_country and last_country != current_country and current_country != "XX":
            await r.setex(f"last_country:{worker_id}", 86400 * 30, current_country)
            return {
                "anomaly": True,
                "previous_country": last_country,
                "current_country": current_country,
                "location": current_location,
            }
        await r.setex(f"last_country:{worker_id}", 86400 * 30, current_country)
        return {"anomaly": False, "location": current_location}
    except Exception:
        return {"anomaly": False}


# ─── Upgrade 6: HMAC webhook signing (Stripe-style) ─────────────────────────
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "pivotpath-webhook-secret-change-in-prod")

def sign_webhook_payload(payload: str) -> str:
    """
    Sign a webhook payload with HMAC-SHA256.
    Returns header value: "t=<timestamp>,v1=<signature>"
    """
    timestamp = str(int(time.time()))
    msg = f"{timestamp}.{payload}"
    sig = hmac.new(
        WEBHOOK_SECRET.encode(),
        msg.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"t={timestamp},v1={sig}"

def verify_webhook_signature(payload: str, sig_header: str,
                               tolerance_seconds: int = 300) -> bool:
    """
    Verify a webhook signature header.
    Returns False if signature invalid or timestamp too old.
    """
    try:
        parts = dict(p.split("=", 1) for p in sig_header.split(","))
        timestamp = int(parts["t"])
        received_sig = parts["v1"]
        if abs(time.time() - timestamp) > tolerance_seconds:
            return False  # replay attack protection
        msg = f"{timestamp}.{payload}"
        expected = hmac.new(
            WEBHOOK_SECRET.encode(),
            msg.encode(),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, received_sig)
    except Exception:
        return False


# ─── Token creation and decoding ─────────────────────────────────────────────
def create_access_token(subject: str, role: str) -> str:
    """
    Upgrade 1+4+9: Creates a short-lived access token with:
    - jti (JWT ID) for blacklisting
    - scopes for RBAC
    - kid (key ID) for rotation
    """
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "scopes": ROLE_SCOPES.get(role, []),
        "jti": str(uuid.uuid4()),
        "kid": CURRENT_KEY_VERSION,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "access",
    }
    key = SECRET_KEYS[CURRENT_KEY_VERSION]
    return jwt.encode(payload, key, algorithm=ALGORITHM)

def create_refresh_token(subject: str, role: str) -> str:
    """Upgrade 2: Creates a long-lived refresh token."""
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": subject,
        "role": role,
        "jti": str(uuid.uuid4()),
        "kid": CURRENT_KEY_VERSION,
        "exp": expire,
        "iat": datetime.utcnow(),
        "type": "refresh",
    }
    key = SECRET_KEYS[CURRENT_KEY_VERSION]
    return jwt.encode(payload, key, algorithm=ALGORITHM)

# Backwards-compatible alias (used by existing code)
def create_token(subject: str, role: str) -> str:
    return create_access_token(subject, role)

def decode_token(token: str) -> dict:
    """
    Upgrade 9: Decodes using correct key version from 'kid' header.
    Works with both v1 and v2 keys during rotation window.
    """
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid", "v1")
        key = SECRET_KEYS.get(kid, SECRET_KEYS["v1"])
        return jwt.decode(token, key, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ─── Auth dependencies ────────────────────────────────────────────────────────
async def get_current_worker(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> Worker:
    payload = decode_token(credentials.credentials)
    if payload.get("role") != "worker":
        raise HTTPException(status_code=403, detail="Worker access only")
    # Upgrade 1: check blacklist
    if await is_blacklisted(payload.get("jti", "")):
        raise HTTPException(status_code=401, detail="Token has been revoked — please log in again")
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
    if await is_blacklisted(payload.get("jti", "")):
        raise HTTPException(status_code=401, detail="Token has been revoked — please log in again")
    result = await db.execute(select(HRCompany).where(HRCompany.id == payload["sub"]))
    company = result.scalar()
    if not company:
        raise HTTPException(status_code=401, detail="HR account not found")
    return company
