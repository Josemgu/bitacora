"""
Authentication service: user creation, credential verification, and the
FastAPI dependencies used to protect endpoints.

When `auth_enabled` is false (the default), protected endpoints still work
but resolve to a synthetic admin identity, so the existing frontend keeps
functioning. Set BITACORA_AUTH_ENABLED=true to enforce real JWT auth.
"""
from __future__ import annotations

import datetime
import logging
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.base import User, UserRole
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

# auto_error=False lets us handle the "auth disabled" case ourselves.
_bearer = HTTPBearer(auto_error=False)

_ROLE_ORDER = {UserRole.student: 0, UserRole.instructor: 1, UserRole.admin: 2}


def create_user(
    db: Session,
    username: str,
    password: str,
    email: Optional[str] = None,
    role: UserRole = UserRole.student,
) -> User:
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("user created: %s (role=%s)", username, role.value)
    return user


def authenticate(db: Session, username: str, password: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        # Same error for unknown user and bad password (no user enumeration).
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    user.last_login = datetime.datetime.utcnow()
    db.commit()
    return user


def issue_tokens(user: User) -> dict[str, str]:
    return {
        "access_token": create_access_token(user.username, user.role.value),
        "refresh_token": create_refresh_token(user.username, user.role.value),
        "token_type": "bearer",
    }


def refresh_access_token(db: Session, refresh_token: str) -> dict[str, str]:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")
    return issue_tokens(user)


# ─── FastAPI dependencies ───


def _synthetic_admin() -> User:
    """Identity used when auth is disabled so read/write flows keep working."""
    u = User()
    u.id = 0
    u.username = "local-admin"
    u.role = UserRole.admin
    u.is_active = True
    return u


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    if not settings.auth_enabled:
        return _synthetic_admin()

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
    except jwt.PyJWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.username == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or disabled")
    return user


def require_role(minimum: UserRole):
    """Dependency factory enforcing a minimum role level."""

    def _dependency(user: User = Depends(get_current_user)) -> User:
        if _ROLE_ORDER[user.role] < _ROLE_ORDER[minimum]:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Requires {minimum.value} privileges",
            )
        return user

    return _dependency


# Convenience dependencies.
require_admin = require_role(UserRole.admin)
require_instructor = require_role(UserRole.instructor)
