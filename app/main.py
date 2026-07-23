"""
Bitacora v2 — FastAPI backend.
Serves the static frontend and provides the REST API.
"""
from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.middleware.security import SecurityHeadersMiddleware
from app.routers import (
    roadmap, resources, mailbox, chat, profile, providers, health, auth,
)
from app.services.seed import seed_if_empty

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("bitacora")

settings = get_settings()

# ─── Paths ───
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# ─── App ───
app = FastAPI(
    title="Bitácora API",
    description="Backend para Bitácora v2 — Learning OS",
    version="2.0.0",
)

# ─── Rate limiting (graceful if slowapi is not installed) ───
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address

    limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit_default])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    logger.info("rate limiting enabled: %s", settings.rate_limit_default)
except ImportError:  # pragma: no cover
    logger.warning("slowapi not installed — rate limiting disabled")

# ─── Security headers ───
app.add_middleware(SecurityHeadersMiddleware)

# ─── CORS — restricted to configured origins (never "*") ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
logger.info("CORS restricted to: %s", settings.cors_origins)


# ─── Generic error handler (no stack-trace leakage in production) ───
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    if settings.is_production:
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


# ─── Routers ───
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(roadmap.router, prefix="/api", tags=["Roadmaps"])
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
    logger.info(
        "Bitácora started (env=%s, auth_enabled=%s)",
        settings.environment, settings.auth_enabled,
    )
