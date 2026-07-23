#!/usr/bin/env python3
"""
Bitacora - Learning OS
Punto de entrada: python run.py
Arranca FastAPI + sirve el frontend estático en localhost:8000
"""
import os

import uvicorn

if __name__ == "__main__":
    # reload defaults to on for local development; disable it in production
    # by setting BITACORA_ENV=production.
    is_prod = os.environ.get("BITACORA_ENV", "development").lower() in {"production", "prod"}
    uvicorn.run(
        "app.main:app",
        host=os.environ.get("BITACORA_HOST", "127.0.0.1"),
        port=int(os.environ.get("BITACORA_PORT", "8000")),
        reload=not is_prod,
    )
