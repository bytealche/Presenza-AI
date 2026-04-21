import base64
import datetime
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from pathlib import Path

from fastapi import APIRouter, Form, Header
from fastapi.responses import JSONResponse

AUTH_SECRET_ENV = "AUTH_SECRET_KEY"
TOKEN_EXPIRY_HOURS = 12
ALLOWED_ROLES = {"admin", "faculty", "student"}


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _now_utc_iso() -> str:
    return datetime.datetime.utcnow().replace(microsecond=0).isoformat()


def _get_secret() -> str:
    return os.getenv(AUTH_SECRET_ENV, "change-me-in-production")


def hash_password(password: str, salt: str | None = None) -> str:
    password = password.strip()
    if not salt:
        salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    )
    return f"pbkdf2_sha256${salt}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, salt, digest = stored_hash.split("$", 2)
    except ValueError:
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hash_password(password, salt=salt)
    return hmac.compare_digest(candidate, stored_hash)


def create_access_token(payload: dict, expires_in_hours: int = TOKEN_EXPIRY_HOURS) -> str:
    body = dict(payload)
    body["exp"] = int((datetime.datetime.utcnow() + datetime.timedelta(hours=expires_in_hours)).timestamp())
    encoded_payload = _b64url_encode(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        _get_secret().encode("utf-8"),
        encoded_payload.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    encoded_sig = _b64url_encode(signature)
    return f"{encoded_payload}.{encoded_sig}"


def decode_access_token(token: str) -> dict | None:
    try:
        payload_part, signature_part = token.split(".", 1)
    except ValueError:
        return None
    expected_sig = hmac.new(
        _get_secret().encode("utf-8"),
        payload_part.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    provided_sig = _b64url_decode(signature_part)
    if not hmac.compare_digest(expected_sig, provided_sig):
        return None
    try:
        payload = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return None
    exp = payload.get("exp")
    if not isinstance(exp, int) or exp < int(datetime.datetime.utcnow().timestamp()):
        return None
    return payload


def init_auth_tables(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute(
        """CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )"""
    )
    conn.commit()
    conn.close()


def build_auth_router(db_path: Path) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/register")
    def register(
        full_name: str = Form(""),
        username: str = Form(""),
        password: str = Form(""),
        role: str = Form("student"),
    ):
        full_name = full_name.strip()
        username = username.strip().lower()
        password = password.strip()
        role = role.strip().lower()

        if not full_name:
            return JSONResponse({"error": "full_name required"}, status_code=400)
        if not username:
            return JSONResponse({"error": "username required"}, status_code=400)
        if len(password) < 6:
            return JSONResponse({"error": "password must be at least 6 characters"}, status_code=400)
        if role not in ALLOWED_ROLES:
            return JSONResponse({"error": "invalid role"}, status_code=400)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE username=? LIMIT 1", (username,))
        existing = c.fetchone()
        if existing is not None:
            conn.close()
            return JSONResponse({"error": "username already exists"}, status_code=409)

        created_at = _now_utc_iso()
        c.execute(
            """
            INSERT INTO users (full_name, username, role, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (full_name, username, role, hash_password(password), created_at),
        )
        user_id = c.lastrowid
        conn.commit()
        conn.close()
        return {
            "registered": True,
            "user": {
                "id": user_id,
                "full_name": full_name,
                "username": username,
                "role": role,
                "created_at": created_at,
            },
        }

    @router.post("/login")
    def login(
        username: str = Form(""),
        password: str = Form(""),
    ):
        username = username.strip().lower()
        password = password.strip()

        if not username or not password:
            return JSONResponse({"error": "username and password required"}, status_code=400)

        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute(
            """
            SELECT id, full_name, username, role, password_hash, created_at
            FROM users
            WHERE username=?
            LIMIT 1
            """,
            (username,),
        )
        row = c.fetchone()
        conn.close()
        if row is None:
            return JSONResponse({"error": "invalid credentials"}, status_code=401)
        if not verify_password(password, row[4]):
            return JSONResponse({"error": "invalid credentials"}, status_code=401)

        user_payload = {
            "user_id": row[0],
            "full_name": row[1],
            "username": row[2],
            "role": row[3],
        }
        token = create_access_token(user_payload)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": row[0],
                "full_name": row[1],
                "username": row[2],
                "role": row[3],
                "created_at": row[5],
            },
        }

    @router.get("/me")
    def me(authorization: str | None = Header(default=None)):
        if not authorization or not authorization.lower().startswith("bearer "):
            return JSONResponse({"error": "missing bearer token"}, status_code=401)
        token = authorization.split(" ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload is None:
            return JSONResponse({"error": "invalid or expired token"}, status_code=401)
        return {"authenticated": True, "user": payload}

    return router
