"""
Authentication router — registration, login, token refresh, and current user.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import User, UserRole
from app.schemas import (
    RefreshRequest, TokenResponse, UserLogin, UserRegister, UserResponse,
)
from app.services.auth import (
    authenticate, create_user, get_current_user, issue_tokens,
    refresh_access_token,
)

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    """Register a new account.

    The very first account created becomes an admin; subsequent self-service
    registrations are students. Instructors/admins are promoted by an admin.
    """
    is_first_user = db.query(User).count() == 0
    role = UserRole.admin if is_first_user else UserRole.student
    user = create_user(db, data.username, data.password, data.email, role)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = authenticate(db, data.username, data.password)
    return issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(data: RefreshRequest, db: Session = Depends(get_db)):
    return refresh_access_token(db, data.refresh_token)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)):
    return user
