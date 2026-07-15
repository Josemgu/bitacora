"""
Bitacora v2 — FastAPI backend.
Serves the static frontend and provides the REST API.
"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import init_db, get_db
from app.routers import (
    roadmap, resources, mailbox, chat, profile, providers, health
)
from app.services.seed import seed_if_empty

# ─── Paths ───
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parent / "static"

# Ensure static directory exists
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# ─── App ───
app = FastAPI(
    title="Bitácora API",
    description="Backend para Bitácora v2 — Learning OS",
    version="2.0.0",
)

# CORS — allow frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ───
app.include_router(roadmap.router, prefix="/api/roadmaps", tags=["Roadmaps"])
app.include_router(resources.router, prefix="/api/resources", tags=["Resources"])
app.include_router(mailbox.router, prefix="/api/mailbox", tags=["Mailbox"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(providers.router, prefix="/api/providers", tags=["AI Providers"])
app.include_router(health.router, prefix="/api", tags=["Health"])

# ─── Static files ───
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


# ─── Startup ───
@app.on_event("startup")
def startup():
    init_db()
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
