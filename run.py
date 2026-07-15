#!/usr/bin/env python3
"""
Bitacora - Learning OS
Punto de entrada: python run.py
Arranca FastAPI + sirve el frontend estático en localhost:8000
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
