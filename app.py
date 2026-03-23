import base64
import math
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from io import BytesIO
from threading import Lock
from typing import Annotated, Optional

import jwt
import qrcode
import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, Text, create_engine
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker

load_dotenv()

def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default

    try:
        parsed = int(value)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name} must be an integer") from exc

    if parsed <= 0:
        raise RuntimeError(f"Environment variable {name} must be greater than 0")

    return parsed


def get_csv_env(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if not raw_value:
        return default

    parsed = [item.strip() for item in raw_value.split(",") if item.strip()]
    return parsed or default


SECRET_KEY = require_env("SECRET_KEY")
DATABASE_URL = require_env("DATABASE_URL")
CLIENT_ID = require_env("CLIENT_ID")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
GEOAPIFY_API_KEY = os.getenv("GEOAPIFY_API_KEY")
ACCESS_TOKEN_EXPIRE_MINUTES = get_int_env("ACCESS_TOKEN_EXPIRE_MINUTES", 15)
REFRESH_TOKEN_EXPIRE_DAYS = get_int_env("REFRESH_TOKEN_EXPIRE_DAYS", 30)
RATE_LIMIT_WINDOW_SECONDS = get_int_env("RATE_LIMIT_WINDOW_SECONDS", 60)
RATE_LIMIT_PUBLIC_PER_WINDOW = get_int_env("RATE_LIMIT_PUBLIC_PER_WINDOW", 100)
RATE_LIMIT_AUTH_PER_WINDOW = get_int_env("RATE_LIMIT_AUTH_PER_WINDOW", 10)
RATE_LIMIT_PROTECTED_IP_PER_WINDOW = get_int_env("RATE_LIMIT_PROTECTED_IP_PER_WINDOW", 100)
RATE_LIMIT_PROTECTED_USER_PER_WINDOW = get_int_env("RATE_LIMIT_PROTECTED_USER_PER_WINDOW", 100)
CORS_ALLOWED_ORIGINS = get_csv_env(
    "CORS_ALLOWED_ORIGINS",
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
)
CORS_ALLOWED_METHODS = get_csv_env("CORS_ALLOWED_METHODS", ["GET", "POST", "OPTIONS"])
CORS_ALLOWED_HEADERS = get_csv_env(
    "CORS_ALLOWED_HEADERS",
    ["Authorization", "Content-Type", "Accept", "Origin"],
)
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

app = FastAPI()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


Base = declarative_base()
buffer = BytesIO()

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Items(Base):
    __tablename__ = "items"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(Text, nullable=False)
    description = Column(Text)
    company_sub = Column(Text, ForeignKey("users.sub"), nullable=False)
    created_at  = Column(DateTime(timezone=True))

    company  = relationship("User", back_populates="items")
    batches  = relationship("Batch", back_populates="item")

class Batch(Base):
    __tablename__ = "batches"

    id          = Column(Integer, primary_key=True, index=True)
    company_sub = Column(Text, ForeignKey("users.sub"), nullable=False)
    item_id     = Column(Integer, ForeignKey("items.id"))
    rm_lot_id  = Column(Integer, ForeignKey("raw_material_lots.id"), nullable=True)
    qty_used   = Column(Float, nullable=True)
    created_at  = Column(DateTime(timezone=True))

    company            = relationship("User", back_populates="batches", foreign_keys=[company_sub])
    item               = relationship("Items", back_populates="batches")
    distribution_codes = relationship("DistributionCode", back_populates="batch")
    cartons            = relationship("Carton", back_populates="batch")
    rm_usages = relationship("BatchRMUsage", back_populates="batch")

class Items_normal(BaseModel):
    id          : int
    name        : str
    description : str
    company_sub : str
    created_at  : str

    class Config:
        from_attributes = True
class DistributionCode(Base):
    __tablename__ = "distribution_codes"

    id          = Column(Integer, primary_key=True, index=True)
    batch_id    = Column(Integer, ForeignKey("batches.id"))
    company_sub = Column(Text, ForeignKey("users.sub"), nullable=False)
    is_used     = Column(Boolean, default=False)
    used_by     = Column(Text, ForeignKey("users.sub"), nullable=True)
    used_at     = Column(DateTime(timezone=True), nullable=True)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True))

    company      = relationship("User", back_populates="distribution_codes", foreign_keys=[company_sub])
    batch        = relationship("Batch", back_populates="distribution_codes")
    carton_codes = relationship("CartonCode", back_populates="distribution_code")


class Carton(Base):
    __tablename__ = "cartons"

    id          = Column(Integer, primary_key=True, index=True)
    batch_id    = Column(Integer, ForeignKey("batches.id"))
    company_sub = Column(Text, ForeignKey("users.sub"), nullable=False)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True))

    company      = relationship("User", back_populates="cartons", foreign_keys=[company_sub])
    batch        = relationship("Batch", back_populates="cartons")
    carton_codes = relationship("CartonCode", back_populates="carton")
class CartonCode(Base):
    __tablename__ = "carton_codes"

    id              = Column(Integer, primary_key=True, index=True)
    carton_id       = Column(Integer, ForeignKey("cartons.id"), nullable=False)
    distribution_id = Column(Integer, ForeignKey("distribution_codes.id"), nullable=False)

    carton            = relationship("Carton", back_populates="carton_codes")
    distribution_code = relationship("DistributionCode", back_populates="carton_codes")


class Product(Base):
    __tablename__ = "products"

    id          = Column(Integer, primary_key=True, index=True)
    carton_id   = Column(Integer, ForeignKey("cartons.id"))
    batch_id    = Column(Integer, ForeignKey("batches.id"))
    company_sub = Column(Text, ForeignKey("users.sub"), nullable=False)
    hashed_uuid = Column(Text, nullable=False)
    is_sold     = Column(Boolean, default=False)
    sold_to     = Column(Text, ForeignKey("users.sub"), nullable=True)
    sold_at     = Column(DateTime(timezone=True), nullable=True)
    expires_at  = Column(DateTime(timezone=True), nullable=True)
    created_at  = Column(DateTime(timezone=True))


class HashedUUID(Base):
    __tablename__ = "hashed_uuids"

    id          = Column(Integer, primary_key=True, index=True)
    hashed_uuid = Column(Text, nullable=False)
    qr_type     = Column(Text, nullable=False)   # 'batch','distribution','carton','product'
    ref_id      = Column(Integer, nullable=False) # FK to whichever table
    created_at  = Column(DateTime(timezone=True))


class ScanLog(Base):
    __tablename__ = "scan_logs"

    id          = Column(Integer, primary_key=True, index=True)
    scanned_by  = Column(Text, ForeignKey("users.sub"), nullable=False)
    qr_type     = Column(Text, nullable=False)
    ref_id      = Column(Integer, nullable=False)
    location    = Column(Text)
    latitude    = Column(Text)
    longitude   = Column(Text)
    scanned_at  = Column(DateTime(timezone=True))

class User(Base):
    __tablename__ = "users"

    id             = Column(Integer, primary_key=True, index=True)
    sub            = Column(Text, unique=True, nullable=False, index=True)
    email          = Column(Text, unique=True, nullable=False)
    name           = Column(Text)
    picture        = Column(Text)
    email_verified = Column(Boolean, default=False)
    jti            = Column(Text)
    disabled       = Column(Boolean, default=False)
    type_user      = Column(Text)                        # 'company', 'customer', 'distributor'
    created_at     = Column(DateTime(timezone=True))

    batches            = relationship("Batch", back_populates="company", foreign_keys="Batch.company_sub")
    distribution_codes = relationship("DistributionCode", back_populates="company", foreign_keys="DistributionCode.company_sub")
    cartons            = relationship("Carton", back_populates="company", foreign_keys="Carton.company_sub")
    items              = relationship("Items", back_populates="company")
    raw_material_lots = relationship("RawMaterialLot", back_populates="supplier")

class RawMaterialLot(Base):
    __tablename__ = "raw_material_lots"

    id             = Column(Integer, primary_key=True, index=True)
    supplier_sub   = Column(Text, ForeignKey("users.sub"), nullable=False)
    material_type  = Column(Text, nullable=False)
    certification  = Column(Text)
    origin         = Column(Text)
    total_qty      = Column(Float, nullable=False)
    remaining_qty  = Column(Float, nullable=False)
    unit           = Column(Text, nullable=False)   # 'kg', 'L', 'units', 'mt'
    created_at     = Column(DateTime(timezone=True))

    supplier   = relationship("User", back_populates="raw_material_lots")
    batch_uses = relationship("BatchRMUsage", back_populates="lot")


class BatchRMUsage(Base):
    __tablename__ = "batch_rm_usage"

    id         = Column(Integer, primary_key=True, index=True)
    batch_id   = Column(Integer, ForeignKey("batches.id"), nullable=False)
    lot_id     = Column(Integer, ForeignKey("raw_material_lots.id"), nullable=False)
    qty_used   = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True))

    batch = relationship("Batch", back_populates="rm_usages")
    lot   = relationship("RawMaterialLot", back_populates="batch_uses")

class Item_details(BaseModel):
    name: str
    description: str
    batch_size: int
    expires_days: int = 90

class Item_batch(BaseModel):
    item_id: int
    batch_id: int

class Item_dist(BaseModel):
    item_id: int
    batch_id: int
    distribution_id: int

class Item_carton(BaseModel):
    item_id: int
    batch_id: int
    carton_id: int
    batch_size: int

class QR(BaseModel):
    qtype: str
    expiry: datetime
    uuid: str

class user_out(BaseModel):
    email: str
    name: str



class TokenData(BaseModel):
    sub: Optional[str] = None

class LotCreate(BaseModel):
    material_type : str
    certification : str
    origin        : str
    total_qty     : float
    unit          : str   # 'kg', 'L', 'units', 'mt'

class GoogleTokenRequest(BaseModel):
    idToken: str
    type: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOWED_METHODS,
    allow_headers=CORS_ALLOWED_HEADERS,
    expose_headers=["Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "X-RateLimit-Scope"],
)


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def evaluate(self, key: str, limit: int, window_seconds: int) -> dict[str, int | bool]:
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                reset_in = max(1, math.ceil(window_seconds - (now - bucket[0])))
                return {
                    "allowed": False,
                    "limit": limit,
                    "remaining": 0,
                    "reset": reset_in,
                }

            bucket.append(now)
            reset_in = max(1, math.ceil(window_seconds - (now - bucket[0])))
            return {
                "allowed": True,
                "limit": limit,
                "remaining": max(0, limit - len(bucket)),
                "reset": reset_in,
            }


rate_limiter = InMemoryRateLimiter()
EXCLUDED_RATE_LIMIT_PATHS = {"/docs", "/redoc", "/openapi.json", "/favicon.ico"}


def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    return request.client.host if request.client else "unknown"


def try_extract_subject_from_request(request: Request) -> Optional[str]:
    authorization = request.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")

    if scheme.lower() != "bearer" or not token:
        return None

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
    except InvalidTokenError:
        return None

    return payload.get("sub")


def get_rate_limit_policy(path: str) -> Optional[dict[str, int | bool | str]]:
    if path in EXCLUDED_RATE_LIMIT_PATHS:
        return None

    if path == "/token":
        return {"scope": "auth", "ip_limit": RATE_LIMIT_AUTH_PER_WINDOW, "user_limit": 0, "use_user_limit": False}

    if path == "/token/refresh":
        return {"scope": "auth", "ip_limit": RATE_LIMIT_AUTH_PER_WINDOW, "user_limit": RATE_LIMIT_AUTH_PER_WINDOW, "use_user_limit": True}

    if path.startswith("/passport/"):
        return {"scope": "public", "ip_limit": RATE_LIMIT_PUBLIC_PER_WINDOW, "user_limit": 0, "use_user_limit": False}

    return {
        "scope": "protected",
        "ip_limit": RATE_LIMIT_PROTECTED_IP_PER_WINDOW,
        "user_limit": RATE_LIMIT_PROTECTED_USER_PER_WINDOW,
        "use_user_limit": True,
    }


def choose_rate_limit_headers(evaluations: list[dict[str, int | bool | str]]) -> dict[str, str]:
    primary = min(
        evaluations,
        key=lambda item: (int(item["remaining"]), int(item["reset"])),
    )
    return {
        "X-RateLimit-Limit": str(primary["limit"]),
        "X-RateLimit-Remaining": str(primary["remaining"]),
        "X-RateLimit-Reset": str(primary["reset"]),
        "X-RateLimit-Scope": str(primary["scope"]),
    }


@app.middleware("http")
async def enforce_rate_limit(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    policy = get_rate_limit_policy(request.url.path)
    if policy is None:
        return await call_next(request)

    evaluations: list[dict[str, int | bool | str]] = []
    scope = str(policy["scope"])
    client_ip = get_client_ip(request)
    evaluations.append(
        {
            **rate_limiter.evaluate(
                key=f"{scope}:ip:{client_ip}",
                limit=int(policy["ip_limit"]),
                window_seconds=RATE_LIMIT_WINDOW_SECONDS,
            ),
            "scope": "ip",
        }
    )

    if bool(policy["use_user_limit"]):
        subject = try_extract_subject_from_request(request)
        if subject:
            evaluations.append(
                {
                    **rate_limiter.evaluate(
                        key=f"{scope}:user:{subject}",
                        limit=int(policy["user_limit"]),
                        window_seconds=RATE_LIMIT_WINDOW_SECONDS,
                    ),
                    "scope": "user",
                }
            )

    blocked = next((evaluation for evaluation in evaluations if not bool(evaluation["allowed"])), None)
    headers = choose_rate_limit_headers(evaluations)

    if blocked is not None:
        headers["Retry-After"] = str(blocked["reset"])
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Try again later."},
            headers=headers,
        )

    response = await call_next(request)
    response.headers.update(headers)
    return response



pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

def hash_uuid(password: str) -> str:
    return pwd_context.hash(password)

def verify_uuid(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def location(lat,lon):
    if not GEOAPIFY_API_KEY:
        return "Unknown location"

    url = "https://api.geoapify.com/v1/geocode/reverse"
    try:
        resp = requests.get(
            url,
            params={"lat": lat, "lon": lon, "apiKey": GEOAPIFY_API_KEY},
            headers={"Accept": "application/json"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", [{}])[0].get("formatted", "Unknown location")
    except requests.RequestException:
        return "Unknown location"

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    to_encode['type'] = 'access'
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    to_encode['type'] = 'refresh'
    jti = str(uuid.uuid4())   
    to_encode['jti'] = jti
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM), jti

def get_user(sub: str, db: Session) -> Optional[User]:
    return db.query(User).filter(User.sub == sub).first()
def make_qr_base64(data: dict) -> str:
    buf = BytesIO()
    img = qrcode.make(str(data))
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

VALID_USER_TYPES = {"company", "customer", "distributor", "retailer", "supplier"}


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def forbidden_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Insufficient permissions for this resource",
    )


def decode_token(token: str, expected_type: Optional[str] = None) -> dict:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "exp", "type"]},
        )
    except InvalidTokenError as exc:
        raise credentials_exception() from exc

    if expected_type and payload.get("type") != expected_type:
        raise credentials_exception()

    return payload


def require_roles(*allowed_roles: str):
    async def dependency(current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.type_user not in allowed_roles:
            raise forbidden_exception()
        return current_user

    return dependency

@app.post('/token')
def verify_google_token(data: GoogleTokenRequest, db: Session = Depends(get_db)):
    try:
        # Validate type before hitting DB
        user_type = data.type
        if user_type not in VALID_USER_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid user type. Must be one of: {VALID_USER_TYPES}")

        id_info = id_token.verify_oauth2_token(
            data.idToken,
            google_requests.Request(),
            CLIENT_ID
        )
        if id_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise HTTPException(status_code=401, detail="Invalid issuer")

        if id_info['aud'] != CLIENT_ID:
            raise HTTPException(status_code=401, detail="Invalid audience")

        user_info = {
            "email":          id_info.get('email'),
            "name":           id_info.get('name', ''),
            "picture":        id_info.get('picture', ''),
            "email_verified": id_info.get('email_verified', False),
            "sub":            id_info.get('sub')
        }

        access_token = create_access_token(data={'sub': user_info['sub'], 'role': user_type})
        refresh_token, jti = create_refresh_token(data={'sub': user_info['sub'], 'role': user_type})

        existing_user = db.query(User).filter(User.sub == user_info["sub"]).first()
    
        if existing_user:
            if existing_user.type_user != data.type:
                raise HTTPException(status_code=400, detail="Account already registered as a different user type")
            existing_user.jti = jti
            db.commit()
        else:
            new_user = User(
                sub            = user_info["sub"],
                email          = user_info["email"],
                name           = user_info["name"],
                picture        = user_info["picture"],
                email_verified = user_info["email_verified"],
                jti            = jti,
                disabled       = False,
                created_at     = datetime.now(timezone.utc),
                type_user      = data.type
            )
            db.add(new_user)
            db.commit()

            # Create sample data for new users
            if data.type == 'company':
                sample_item = Items(
                    name        = "Sample Product",
                    description = "A sample product for demonstration",
                    company_sub = user_info["sub"]
                )
                db.add(sample_item)
                db.commit()
            elif data.type == 'supplier':
                sample_lot = RawMaterialLot(
                    supplier_sub  = user_info["sub"],
                    material_type = "Coffee Beans",
                    certification = "Organic",
                    origin        = "Ethiopia",
                    total_qty     = 1000.0,
                    remaining_qty = 1000.0,
                    unit          = "kg",
                    created_at    = datetime.now(timezone.utc)
                )
                db.add(sample_lot)
                db.commit()

        return {
            "access_token":  access_token,
            "refresh_token": refresh_token,
            "token_type":    "bearer"
        }

    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    '''except Exception as e:
        raise HTTPException(status_code=500, detail="Authentication error")'''


@app.post("/token/refresh")
def renew_tokens(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    payload = decode_token(token, expected_type="refresh")
    sub = payload.get("sub")
    jti_token = payload.get('jti')

    user = db.query(User).filter(User.sub == sub).first()
    if not user or user.jti != jti_token:
        raise credentials_exception()

    refresh_token, jti = create_refresh_token(
        data={"sub": user.sub, "role": user.type_user}
    )
    user.jti = jti
    db.commit()

    access_token = create_access_token(
        data={"sub": sub, "role": user.type_user}
    )
    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer"
    }


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    payload = decode_token(token, expected_type="access")
    sub = payload.get("sub")
    token_data = TokenData(sub=sub)

    user = get_user(sub=token_data.sub, db=db)
    if user is None:
        raise credentials_exception()
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    if current_user.disabled:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


@app.post('/logout')
def logout(user: Annotated[User, Depends(get_current_active_user)], db: Session = Depends(get_db)):
    db.query(User).filter(User.sub == user.sub).update({User.jti: None})
    db.commit()
    return {"detail": "Successfully logged out"}

@app.get("/users/me")
async def get_me(current_user: User = Depends(get_current_active_user)):
    return {
        "id":        current_user.id,
        "sub":       current_user.sub,
        "email":     current_user.email,
        "name":      current_user.name,
        "picture":   current_user.picture,
        "type_user": current_user.type_user,
    }

class Item_details(BaseModel):
    name        : str
    description : str
    batch_size  : int
    expires_days: int = 90
    rm_lot_id   : int          # NEW — required
    qty_used    : float        # NEW — required

@app.post('/token/company/batch')
def batch_qr(
    item_detail: Item_details,
    user: Annotated[User, Depends(require_roles("company"))],
    db: Session = Depends(get_db)
):
    # ── MASS BALANCE CHECK ─────────────────────────────────────────────
    lot = db.query(RawMaterialLot).filter(
        RawMaterialLot.id == item_detail.rm_lot_id
    ).first()

    if not lot:
        raise HTTPException(status_code=404, detail="Raw material lot not found")

    if lot.remaining_qty < item_detail.qty_used:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient raw material: lot has {lot.remaining_qty} {lot.unit} "
                   f"remaining, batch requires {item_detail.qty_used} {lot.unit}"
        )
    # ──────────────────────────────────────────────────────────────────

    expiry = datetime.now(timezone.utc) + timedelta(days=item_detail.expires_days)

    new_item = Items(
        name        = item_detail.name,
        description = item_detail.description,
        company_sub = user.sub,
        created_at  = datetime.now(timezone.utc),
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)

    new_batch = Batch(
        company_sub = user.sub,
        item_id     = new_item.id,
        rm_lot_id   = item_detail.rm_lot_id,   # NEW
        qty_used    = item_detail.qty_used,     # NEW
        created_at  = datetime.now(timezone.utc),
    )
    db.add(new_batch)
    db.commit()
    db.refresh(new_batch)

    # ── DEDUCT FROM LOT ATOMICALLY ─────────────────────────────────────
    lot.remaining_qty -= item_detail.qty_used
    db.add(BatchRMUsage(
        batch_id   = new_batch.id,
        lot_id     = lot.id,
        qty_used   = item_detail.qty_used,
        created_at = datetime.now(timezone.utc),
    ))
    db.commit()
    # ──────────────────────────────────────────────────────────────────

    ticket      = str(uuid.uuid4())
    hashed_uuid = hash_uuid(ticket)
    db.add(HashedUUID(
        hashed_uuid = hashed_uuid,
        qr_type     = "batch",
        ref_id      = new_batch.id,
        created_at  = datetime.now(timezone.utc),
    ))
    db.commit()

    qr_data      = {"type": "batch", "id": new_batch.id, "uuid": ticket,
                    "expires_at": str(expiry)}
    image_base64 = make_qr_base64(qr_data)
    return {
        "qr":      image_base64,
        "batch_id": new_batch.id,
        "item_id":  new_item.id,
        "lot_remaining_after": lot.remaining_qty,
    }


@app.get('/token/company/batch/{batch_id}/qr')
def get_batch_qr(batch_id: int,
    user: Annotated[User, Depends(require_roles("company"))],
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.company_sub == user.sub).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    ticket = str(uuid.uuid4())
    expiry = datetime.now(timezone.utc) + timedelta(days=365)

    db.add(HashedUUID(
        hashed_uuid = hash_uuid(ticket),
        qr_type     = "batch",
        ref_id      = batch.id,
        created_at  = datetime.now(timezone.utc),
    ))
    db.commit()

    qr_data = {"type": "batch", "id": batch.id, "uuid": ticket, "expires_at": str(expiry)}
    image_base64 = make_qr_base64(qr_data)
    return {"qr": image_base64}


@app.post('/token/company/distribution')#remove the wr code and just add the uuid to database to make sure that any of all the cartons can be scanned 
def distribution_qr(item:Item_batch, distributors :list ,user: Annotated[User, Depends(require_roles("company"))], db: Session = Depends(get_db)):
    expiry = datetime.now(timezone.utc) + timedelta(days=90)
    distribution_codes=[]
    for i in range (len(distributors)):
        # Save distribution code to DB
        dist_code = DistributionCode(
            batch_id    = item.batch_id,
            company_sub = user.sub,
            used_by     = distributors[i],   # assign the distributor
            expires_at  = expiry,
            created_at  = datetime.now(timezone.utc),
        )
        db.add(dist_code)
        db.commit()
        db.refresh(dist_code)

        # Generate and store hashed UUID
        #update item_dist with a new item consisting of details from item_batch
        ticket=str(uuid.uuid4())
        hashed_uuid=hash_uuid(ticket)#add to item_details as distribution_hashed_uuid
        db.add(HashedUUID(
            hashed_uuid = hashed_uuid,
            qr_type     = "distribution",
            ref_id      = dist_code.id,
            created_at  = datetime.now(timezone.utc),
        ))
        db.commit()

        qr_data    = {"type": "distribution", "id": dist_code.id, "uuid": ticket, "expires_at": str(expiry)}
        image_base64 = make_qr_base64(qr_data)
        distribution_codes.append(image_base64)
    return distribution_codes

@app.post('/token/company/carton')
def carton_qr(item:Item_dist,cartons_count:int ,user: Annotated[User, Depends(require_roles("company"))], db: Session = Depends(get_db)):
    expiry = datetime.now(timezone.utc) + timedelta(days=90)
    carton_codes=[]
    for i in range (cartons_count):
        # Save carton to DB
        new_carton = Carton(
            batch_id    = item.batch_id,
            company_sub = user.sub,
            expires_at  = expiry,
            created_at  = datetime.now(timezone.utc),
        )
        db.add(new_carton)
        db.commit()
        db.refresh(new_carton)

        # Link distribution code to this carton
        db.add(CartonCode(
            carton_id       = new_carton.id,
            distribution_id = item.distribution_id,
        ))

        # Generate and store hashed UUID
        ticket=str(uuid.uuid4())
        hashed_uuid=hash_uuid(ticket)#add to item_details as carton_hashed_uuid
        db.add(HashedUUID(
            hashed_uuid = hashed_uuid,
            qr_type     = "carton",
            ref_id      = new_carton.id,
            created_at  = datetime.now(timezone.utc),
        ))
        db.commit()

        qr_data    = {"type": "carton", "id": new_carton.id, "uuid": ticket, "expires_at": str(expiry)}
        image_base64 = make_qr_base64(qr_data)
        carton_codes.append(image_base64)
    return carton_codes

@app.post('/token/company/product')
def product_qr( item:Item_carton,user: Annotated[User, Depends(require_roles("company"))], db: Session = Depends(get_db)):
    expiry = datetime.now(timezone.utc) + timedelta(days=365)
    products_codes=[]
    for i in range (item.batch_size):
        #update item_products with product id and item_carton
        ticket=str(uuid.uuid4())
        hashed_uuid=hash_uuid(ticket)#add to item_details as product_hashed_uuid
         # Save product to DB
        new_product = Product(
            carton_id   = item.carton_id,
            batch_id    = item.batch_id,
            company_sub = user.sub,
            hashed_uuid = hashed_uuid,
            expires_at  = expiry,
            created_at  = datetime.now(timezone.utc),
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        db.add(HashedUUID(
            hashed_uuid = hashed_uuid,
            qr_type     = "product",
            ref_id      = new_product.id,
            created_at  = datetime.now(timezone.utc),
        ))
        db.commit()

        qr_data    = {"type": "product", "id": new_product.id, "uuid": ticket, "expires_at": str(expiry)}
        image_base64 = make_qr_base64(qr_data)
        products_codes.append(image_base64)
    return products_codes

@app.post('/token/distributor')
def scan_distributor(
    qr: QR,
    lat: float,
    lon: float,
    user: Annotated[User, Depends(require_roles("distributor"))],
    db: Session = Depends(get_db)
):
    if qr.expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    stored = db.query(HashedUUID).filter(HashedUUID.qr_type == qr.qtype).all()
    match  = next((h for h in stored if verify_uuid(qr.uuid, h.hashed_uuid)), None)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid QR code")


    loc  = location(lat, lon)
    time = datetime.now(timezone.utc)

    # Log the scan to DB
    scan = ScanLog(
        scanned_by = user.sub,
        qr_type    = qr.qtype,
        ref_id     = match.ref_id,
        location   = loc,
        latitude   = str(lat),
        longitude  = str(lon),
        scanned_at = time,
    )
    db.add(scan)
    db.commit()

    return {"success": True, "location": loc, "ref_id": match.ref_id, "type": qr.qtype}
    #add loc,time and user details to database of item_journey in that distributors name(sub) along with all the data about the same item in item_details
    #if db commit successful return true

@app.post('/token/retailer')
def scan_retailer(
    qr: QR,
    lat: float,
    lon: float,
    user: Annotated[User, Depends(require_roles("retailer"))],
    db: Session = Depends(get_db)
):
    # Only accept carton or product QR types at retail level
    if qr.qtype not in ("carton", "product"):
        raise HTTPException(status_code=400, detail="Invalid QR type for retailer")

    # Check expiry
    if qr.expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="QR code has expired")

    # Find matching hashed UUID
    stored = db.query(HashedUUID).filter(HashedUUID.qr_type == qr.qtype).all()
    match  = next((h for h in stored if verify_uuid(qr.uuid, h.hashed_uuid)), None)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid QR code")

    loc  = location(lat, lon)
    time = datetime.now(timezone.utc)

    # Log the scan
    scan = ScanLog(
        scanned_by = user.sub,
        qr_type    = qr.qtype,
        ref_id     = match.ref_id,
        location   = loc,
        latitude   = str(lat),
        longitude  = str(lon),
        scanned_at = time,
    )
    db.add(scan)

    # If it's a product scan, mark it as sold
    if qr.qtype == "product":
        product = db.query(Product).filter(Product.id == match.ref_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        if product.is_sold:
            raise HTTPException(status_code=400, detail="Product already sold")

        product.is_sold = True
        product.sold_to = user.sub
        product.sold_at = time

    db.commit()

    return {
        "success":  True,
        "location": loc,
        "ref_id":   match.ref_id,
        "type":     qr.qtype
    }


@app.post('/token/consumer')
def scan_customer(
    qr: QR,
    user: Annotated[User, Depends(require_roles("customer"))],
    db: Session = Depends(get_db)
):
    if qr.qtype not in ("batch", "distribution", "carton", "product"):
        raise HTTPException(status_code=400, detail="Invalid QR type")
    if qr.expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="QR code has expired")
    # Find matching hashed UUID
    stored = db.query(HashedUUID).filter(HashedUUID.qr_type == qr.qtype).all()
    match  = next((h for h in stored if verify_uuid(qr.uuid, h.hashed_uuid)), None)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid QR code")

    ref_id = match.ref_id

    # Fetch the full journey: all scan logs for this ref_id and type
    scan_logs = (
        db.query(ScanLog)
        .filter(ScanLog.qr_type == qr.qtype, ScanLog.ref_id == ref_id)
        .order_by(ScanLog.scanned_at)
        .all()
    )

    journey = []
    for log in scan_logs:
        scanner = db.query(User).filter(User.sub == log.scanned_by).first()
        journey.append({
            "scanned_by":      scanner.name if scanner else log.scanned_by,
            "scanned_by_type": scanner.type_user if scanner else None,
            "location":        log.location,
            "latitude":        log.latitude,
            "longitude":       log.longitude,
            "scanned_at":      str(log.scanned_at),
        })

    # Fetch item details based on QR type
    item_details = {}

    if qr.qtype == "product":
        product = db.query(Product).filter(Product.id == ref_id).first()
        if product:
            batch = db.query(Batch).filter(Batch.id == product.batch_id).first()
            item  = db.query(Items).filter(Items.id == batch.item_id).first() if batch else None
            item_details = {
                "product_id":  product.id,
                "is_sold":     product.is_sold,
                "sold_at":     str(product.sold_at) if product.sold_at else None,
                "expires_at":  str(product.expires_at),
                "batch_id":    product.batch_id,
                "item_name":        item.name if item else None,
                "item_description": item.description if item else None,
            }

    elif qr.qtype == "carton":
        carton = db.query(Carton).filter(Carton.id == ref_id).first()
        if carton:
            batch = db.query(Batch).filter(Batch.id == carton.batch_id).first()
            item  = db.query(Items).filter(Items.id == batch.item_id).first() if batch else None
            products = db.query(Product).filter(Product.carton_id == ref_id).all()
            item_details = {
                "carton_id":        carton.id,
                "expires_at":       str(carton.expires_at),
                "batch_id":         carton.batch_id,
                "item_name":        item.name if item else None,
                "item_description": item.description if item else None,
                "total_products":   len(products),
                "sold_products":    sum(1 for p in products if p.is_sold),
            }

    elif qr.qtype == "batch":
        batch = db.query(Batch).filter(Batch.id == ref_id).first()
        if batch:
            item = db.query(Items).filter(Items.id == batch.item_id).first()
            item_details = {
                "batch_id":         batch.id,
                "item_name":        item.name if item else None,
                "item_description": item.description if item else None,
                "created_at":       str(batch.created_at),
            }

    elif qr.qtype == "distribution":
        dist = db.query(DistributionCode).filter(DistributionCode.id == ref_id).first()
        if dist:
            batch = db.query(Batch).filter(Batch.id == dist.batch_id).first()
            item  = db.query(Items).filter(Items.id == batch.item_id).first() if batch else None
            item_details = {
                "distribution_id":  dist.id,
                "is_used":          dist.is_used,
                "expires_at":       str(dist.expires_at),
                "item_name":        item.name if item else None,
                "item_description": item.description if item else None,
            }

    return {
        "qr_type":     qr.qtype,
        "ref_id":      ref_id,
        "item_details": item_details,
        "journey":     journey,
    }
@app.post('/token/supplier')
def scan_supplier(
    qr: QR,
    weight: float,
    lat: float,
    lon: float,
    user: Annotated[User, Depends(require_roles("supplier"))],
    db: Session = Depends(get_db)
):
    if qr.qtype != "batch":
        raise HTTPException(status_code=400, detail="Invalid QR Code: suppliers can only scan batch QR codes")

    if qr.expiry < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="QR code has expired")

    # Find matching hashed UUID in DB
    stored = db.query(HashedUUID).filter(HashedUUID.qr_type == "batch").all()
    match  = next((h for h in stored if verify_uuid(qr.uuid, h.hashed_uuid)), None)

    if not match:
        raise HTTPException(status_code=400, detail="Invalid QR code: batch not found")

    # Fetch the batch and its linked item
    batch = db.query(Batch).filter(Batch.id == match.ref_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    item = db.query(Items).filter(Items.id == batch.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    loc  = location(lat, lon)
    time = datetime.now(timezone.utc)

    # Log the scan with supplier details
    scan = ScanLog(
        scanned_by = user.sub,
        qr_type    = "batch",
        ref_id     = match.ref_id,
        location   = loc,
        latitude   = str(lat),
        longitude  = str(lon),
        scanned_at = time,
    )
    db.add(scan)
    db.commit()

    return {
        "success":    True,
        "location":   loc,
        "scanned_at": str(time),
        "batch_id":   batch.id,
        "item": {
            "id":          item.id,
            "name":        item.name,
            "description": item.description,
        },
        "supplier": {
            "sub":   user.sub,
            "name":  user.name,
            "email": user.email,
        },
        "weight_received": weight,
    }
# ── Supplier: register a raw material lot ──────────────────────────────
@app.post('/supplier/lots')
def create_lot(
    lot: LotCreate,
    user: Annotated[User, Depends(require_roles("supplier"))],
    db: Session = Depends(get_db)
):
    new_lot = RawMaterialLot(
        supplier_sub  = user.sub,
        material_type = lot.material_type,
        certification = lot.certification,
        origin        = lot.origin,
        total_qty     = lot.total_qty,
        remaining_qty = lot.total_qty,   # starts full
        unit          = lot.unit,
        created_at    = datetime.now(timezone.utc),
    )
    db.add(new_lot)
    db.commit()
    db.refresh(new_lot)
    return {"success": True, "lot_id": new_lot.id, "lot": {
        "id": new_lot.id,
        "material_type": new_lot.material_type,
        "certification": new_lot.certification,
        "origin": new_lot.origin,
        "total_qty": new_lot.total_qty,
        "remaining_qty": new_lot.remaining_qty,
        "unit": new_lot.unit,
    }}


# ── Supplier: list their lots ──────────────────────────────────────────
@app.get('/supplier/lots')
def list_lots(
    user: Annotated[User, Depends(require_roles("supplier"))],
    db: Session = Depends(get_db)
):
    lots = db.query(RawMaterialLot).filter(
        RawMaterialLot.supplier_sub == user.sub
    ).order_by(RawMaterialLot.created_at.desc()).all()

    return [
        {
            "id":            l.id,
            "material_type": l.material_type,
            "certification": l.certification,
            "origin":        l.origin,
            "total_qty":     l.total_qty,
            "remaining_qty": l.remaining_qty,
            "unit":          l.unit,
            "created_at":    str(l.created_at),
            "status":        "depleted" if l.remaining_qty == 0 else "active",
        }
        for l in lots
    ]


# ── Manufacturer: list available lots (to pick from in batch creation) ─
@app.get('/manufacturer/lots')
def list_available_lots(
    user: Annotated[User, Depends(require_roles("company"))],
    db: Session = Depends(get_db)
):
    lots = db.query(RawMaterialLot).filter(
        RawMaterialLot.remaining_qty > 0
    ).all()

    return [
        {
            "id":            l.id,
            "material_type": l.material_type,
            "certification": l.certification,
            "origin":        l.origin,
            "total_qty":     l.total_qty,
            "remaining_qty": l.remaining_qty,
            "unit":          l.unit,
        }
        for l in lots
    ]
def compute_trust_score(product_id: int, db: Session) -> dict:
    """
    Rule-based trust score (0-100). Returns score + color tier + flags.
    Rules (each deducts points):
      - No scans at all              → 60 (unknown, start cautious)
      - Missing distributor scan     → -15
      - Missing retailer scan        → -10
      - Geo-impossible scan          → -40 (same QR, 2 cities, < 5 min apart)
      - High scan frequency spike    → -20
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return {"score": 0, "tier": "red", "flags": ["Product not found"]}

    # All scans for this product
    scans = (
        db.query(ScanLog)
        .filter(ScanLog.qr_type == "product", ScanLog.ref_id == product_id)
        .order_by(ScanLog.scanned_at)
        .all()
    )

    score = 100
    flags = []

    # Rule 1: Check journey completeness via scan actor types
    scanner_types = set()
    for s in scans:
        scanner = db.query(User).filter(User.sub == s.scanned_by).first()
        if scanner:
            scanner_types.add(scanner.type_user)

    if "distributor" not in scanner_types:
        score -= 15
        flags.append("Missing distributor scan")
    if "retailer" not in scanner_types:
        score -= 10
        flags.append("Missing retailer scan")

    # Rule 2: Geo-impossible scan detection (same QR, distant cities, < 5 min)
    for i in range(1, len(scans)):
        prev, curr = scans[i - 1], scans[i]
        time_diff_minutes = (curr.scanned_at - prev.scanned_at).total_seconds() / 60

        if time_diff_minutes < 5 and prev.latitude and curr.latitude:
            try:
                lat1, lon1 = float(prev.latitude), float(prev.longitude)
                lat2, lon2 = float(curr.latitude), float(curr.longitude)

                # Haversine distance in km
                R = 6371
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a    = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * \
                       math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                dist_km = R * 2 * math.asin(math.sqrt(a))

                if dist_km > 100:   # > 100 km in < 5 min = physically impossible
                    score -= 40
                    flags.append(
                        f"Clone detected: scanned {dist_km:.0f} km apart in "
                        f"{time_diff_minutes:.1f} min"
                    )
            except (ValueError, TypeError):
                pass

    # Rule 3: High scan frequency (> 10 consumer scans in 1 hour)
    consumer_scans = [
        s for s in scans
        if db.query(User).filter(User.sub == s.scanned_by,
                                  User.type_user == "customer").first()
    ]
    if len(consumer_scans) > 10:
        score -= 20
        flags.append(f"High scan frequency: {len(consumer_scans)} consumer scans")

    score = max(0, score)

    if score >= 90:
        tier = "green"
    elif score >= 50:
        tier = "orange"
    else:
        tier = "red"

    return {"score": score, "tier": tier, "flags": flags}

@app.get('/passport/{product_id}')
def get_passport(product_id: int, db: Session = Depends(get_db)):
    """
    Public endpoint — no auth required. Returns full Digital Product Passport.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    batch = db.query(Batch).filter(Batch.id == product.batch_id).first()
    item  = db.query(Items).filter(Items.id == batch.item_id).first() if batch else None

    # Raw material origin
    raw_material = None
    if batch and batch.rm_lot_id:
        lot = db.query(RawMaterialLot).filter(RawMaterialLot.id == batch.rm_lot_id).first()
        if lot:
            supplier = db.query(User).filter(User.sub == lot.supplier_sub).first()
            raw_material = {
                "material_type":    lot.material_type,
                "certification":    lot.certification,
                "origin":           lot.origin,
                "supplier_name":    supplier.name if supplier else None,
                "total_qty":        lot.total_qty,
                "remaining_qty":    lot.remaining_qty,
                "unit":             lot.unit,
            }

    # Full journey from ScanLog
    scans = (
        db.query(ScanLog)
        .filter(ScanLog.qr_type == "product", ScanLog.ref_id == product_id)
        .order_by(ScanLog.scanned_at)
        .all()
    )
    journey = []
    for log in scans:
        scanner = db.query(User).filter(User.sub == log.scanned_by).first()
        journey.append({
            "actor":        scanner.name if scanner else "Unknown",
            "actor_type":   scanner.type_user if scanner else None,
            "location":     log.location,
            "latitude":     log.latitude,
            "longitude":    log.longitude,
            "scanned_at":   str(log.scanned_at),
        })

    # Trust Score
    trust = compute_trust_score(product_id, db)

    return {
        "product_id":   product.id,
        "item_name":    item.name if item else None,
        "description":  item.description if item else None,
        "batch_id":     product.batch_id,
        "expires_at":   str(product.expires_at),
        "created_at":   str(product.created_at),
        "is_sold":      product.is_sold,
        "raw_material": raw_material,
        "journey":      journey,
        "trust_score":  trust,
    }
@app.get('/manufacturer/batches')
def list_batches(
    user: Annotated[User, Depends(require_roles("company"))],
    db: Session = Depends(get_db)
):
    batches = (
        db.query(Batch)
        .filter(Batch.company_sub == user.sub)
        .order_by(Batch.created_at.desc())
        .all()
    )

    result = []
    for b in batches:
        item      = db.query(Items).filter(Items.id == b.item_id).first()
        products  = db.query(Product).filter(Product.batch_id == b.id).all()
        lot       = db.query(RawMaterialLot).filter(
                       RawMaterialLot.id == b.rm_lot_id).first() if b.rm_lot_id else None

        result.append({
            "batch_id":     b.id,
            "item_name":    item.name if item else None,
            "created_at":   str(b.created_at),
            "total_units":  len(products),
            "sold_units":   sum(1 for p in products if p.is_sold),
            "lot": {
                "material_type": lot.material_type,
                "qty_used":      b.qty_used,
                "unit":          lot.unit,
                "total_qty":     lot.total_qty,
            } if lot else None,
        })

    return result

@app.get('/distributor/scans')
def list_distributor_scans(
    user: Annotated[User, Depends(require_roles("distributor"))],
    db: Session = Depends(get_db)
):
    scans = (
        db.query(ScanLog)
        .filter(ScanLog.scanned_by == user.sub)
        .order_by(ScanLog.scanned_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for s in scans:
        # If it's a carton scan, count linked products
        product_count = 0
        if s.qr_type == "carton":
            product_count = db.query(Product).filter(
                Product.carton_id == s.ref_id
            ).count()
        elif s.qr_type == "product":
            product_count = 1

        result.append({
            "scan_id":       s.id,
            "qr_type":       s.qr_type,
            "ref_id":        s.ref_id,
            "location":      s.location,
            "scanned_at":    str(s.scanned_at),
            "product_count": product_count,
        })

    return result


@app.get('/retailer/scans')
def list_retailer_scans(
    user: Annotated[User, Depends(require_roles("retailer"))],
    db: Session = Depends(get_db)
):
    scans = (
        db.query(ScanLog)
        .filter(ScanLog.scanned_by == user.sub)
        .order_by(ScanLog.scanned_at.desc())
        .limit(50)
        .all()
    )

    result = []
    for s in scans:
        product_count = 0
        if s.qr_type == "carton":
            product_count = db.query(Product).filter(
                Product.carton_id == s.ref_id
            ).count()
        elif s.qr_type == "product":
            product_count = 1

        result.append({
            "scan_id":       s.id,
            "qr_type":       s.qr_type,
            "ref_id":        s.ref_id,
            "location":      s.location,
            "scanned_at":    str(s.scanned_at),
            "product_count": product_count,
            "journey_complete": s.qr_type == "carton",  # simplified
        })

    return result
