import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone

SECRET_KEY = "change-me-in-production-please"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: int, org_slug: str, username: str) -> str:
    payload = {
        "sub": str(user_id),
        "org": org_slug,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
