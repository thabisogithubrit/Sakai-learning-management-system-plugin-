from __future__ import annotations

import base64
import hashlib
import os
import secrets
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, Header, HTTPException, status

from app.core.session import SessionContext


# Static demo passwords are NOT stored here.
# Only salted PBKDF2 hashes are stored.
#
# Actual demo passwords:
# STUDENT  -> Student@123
# LECTURER -> Lecturer@123
# ADVISOR  -> Advisor@123
# ADMIN    -> Admin@123
ROLE_PASSWORD_HASHES = {
    "STUDENT": "200000$c3NwYS1kZW1vLXN0dWRlbnQtc2FsdA==$t6QzJi5YtM8n3vvE0t3XCChPMKQi+5sJrFZdwLL94L0=",
    "LECTURER": "200000$c3NwYS1kZW1vLWxlY3R1cmVyLXNhbHQ=$juGlsbYrbIKfMYdywrzjH5bZ4dGTO4aKebkpjXeN6KA=",
    "ADVISOR": "200000$c3NwYS1kZW1vLWFkdmlzb3Itc2FsdA==$/39pNgRogkav54lqlAO8uwah8pCJ/IhcvZi7JuQ3xkc=",
    "ADMIN": "200000$c3NwYS1kZW1vLWFkbWluLXNhbHQ=$28C2uB6wTWnH3nCY9okDoAB18MXWb7BXY0M1nfEuFH8=",
}

TOKEN_TTL_SECONDS = int(os.getenv("SSPA_TOKEN_TTL_SECONDS", "28800"))

# Token store keeps token hashes only, not raw tokens.
# This is enough for local/demo mode.
_TOKEN_STORE: dict[str, dict] = {}


def _get_password_hash_for_role(role: str) -> str:
    role = role.upper()

    # Optional production-style override:
    # SSPA_STUDENT_PASSWORD_HASH
    # SSPA_LECTURER_PASSWORD_HASH
    # SSPA_ADVISOR_PASSWORD_HASH
    # SSPA_ADMIN_PASSWORD_HASH
    env_key = f"SSPA_{role}_PASSWORD_HASH"

    return os.getenv(env_key, ROLE_PASSWORD_HASHES.get(role, ""))


def verify_password(role: str, password: str) -> bool:
    role = role.upper()
    stored = _get_password_hash_for_role(role)

    if not stored or not password:
        return False

    try:
        iterations_text, salt_b64, expected_b64 = stored.split("$", 2)
        iterations = int(iterations_text)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(expected_b64)

        actual = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )

        return secrets.compare_digest(actual, expected)

    except Exception:
        return False


def authenticate_role_password(role: str, password: str) -> None:
    role = role.upper()

    if role not in ROLE_PASSWORD_HASHES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unsupported role",
        )

    if not verify_password(role, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid role password",
        )


def issue_access_token(session: SessionContext) -> dict:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expires_at_epoch = int(time.time()) + TOKEN_TTL_SECONDS

    _TOKEN_STORE[token_hash] = {
        "session": session.model_dump(),
        "expires_at": expires_at_epoch,
    }

    return {
        "access_token": raw_token,
        "token_type": "bearer",
        "expires_at": datetime.fromtimestamp(
            expires_at_epoch,
            tz=timezone.utc,
        ).isoformat(),
    }


def get_current_session(
    authorization: Optional[str] = Header(default=None, alias="Authorization"),
) -> SessionContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    raw_token = authorization.split(" ", 1)[1].strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
        )

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    record = _TOKEN_STORE.get(token_hash)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if int(time.time()) > int(record["expires_at"]):
        _TOKEN_STORE.pop(token_hash, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )

    return SessionContext(**record["session"])


def require_roles(*allowed_roles: str):
    allowed = {role.upper() for role in allowed_roles}

    def dependency(session: SessionContext = Depends(get_current_session)):
        if session.role.upper() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {', '.join(sorted(allowed))}",
            )

        return session

    return dependency