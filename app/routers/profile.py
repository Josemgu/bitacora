"""
User profile router — single-user app profile management.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.base import UserProfile
from app.schemas import UserProfileBase, UserProfileResponse
from backend.security.rate_limit import limiter, standard_limit


class ProfileConfigBase(UserProfileBase):
    pass

router = APIRouter()


@router.get("", response_model=UserProfileResponse)
@limiter.limit(standard_limit)
def get_profile(request: Request, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("", response_model=UserProfileResponse)
@limiter.limit(standard_limit)
def update_profile(request: Request, data: UserProfileBase, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile(**data.model_dump())
        db.add(profile)
    else:
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/config", response_model=UserProfileResponse)
@limiter.limit(standard_limit)
def get_profile_config(request: Request, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile()
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.put("/config", response_model=UserProfileResponse)
@limiter.limit(standard_limit)
def update_profile_config(request: Request, data: ProfileConfigBase, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile(**data.model_dump())
        db.add(profile)
    else:
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
    db.commit()
    db.refresh(profile)
    return profile

