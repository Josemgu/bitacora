"""
B3 integration test: confirms the rate limiter is wired into the real FastAPI app
so that endpoints like /api/profile/config return HTTP 429 after the standard limit.
"""
from __future__ import annotations

import importlib

from fastapi.testclient import TestClient


def test_standard_limit_is_enforced_on_profile_config(monkeypatch, tmp_path):
    # Fresh temp DB
    db_path = tmp_path / "bitacora-test-rl.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("BITACORA_MODE", "selfhost")

    # Reload modules so the settings cache picks up the new env
    import app.config as config_module
    import app.database as database_module
    import app.models.base as models_base_module
    import app.routers.profile as profile_router
    import app.routers.chat as chat_router
    import app.services.seed as seed_module
    import app.main as main_module

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(database_module)
    importlib.reload(models_base_module)
    importlib.reload(profile_router)
    importlib.reload(chat_router)
    importlib.reload(seed_module)
    importlib.reload(main_module)

    database_module.init_db()

    client = TestClient(main_module.app)

    # standard_limit = 60/minute ⇒ request 61 times and expect a 429
    statuses = []
    for _ in range(61):
        resp = client.get("/api/profile/config")
        statuses.append(resp.status_code)
        if resp.status_code == 429:
            break

    assert 429 in statuses, "Rate limiter did not kick in on /api/profile/config"


def test_ai_limit_is_enforced_on_chat(monkeypatch, tmp_path):
    db_path = tmp_path / "bitacora-test-rl-ai.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("BITACORA_MODE", "selfhost")

    import app.config as config_module
    import app.database as database_module
    import app.models.base as models_base_module
    import app.routers.profile as profile_router
    import app.routers.chat as chat_router
    import app.services.seed as seed_module
    import app.main as main_module

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(database_module)
    importlib.reload(models_base_module)
    importlib.reload(profile_router)
    importlib.reload(chat_router)
    importlib.reload(seed_module)
    importlib.reload(main_module)

    database_module.init_db()

    client = TestClient(main_module.app)

    payload = {"role": "user", "content": "hola"}

    # ai_limit = 5/minute ⇒ request 6 times and expect a 429
    statuses = []
    for _ in range(6):
        resp = client.post("/api/chat/chat", json=payload)
        statuses.append(resp.status_code)
        if resp.status_code == 429:
            break

    assert 429 in statuses, "AI rate limiter did not kick in on /api/chat/chat"
