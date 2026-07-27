"""
A2 formal test: POST /api/roadmaps/import endpoint.

Uses FastAPI TestClient (no manual server needed). Each test gets a
fresh temp DB via monkeypatch + importlib.reload, following the same
pattern as tests/test_rate_limit_integration.py.
"""
from __future__ import annotations

import importlib
import io
import json

from fastapi.testclient import TestClient


# ── Helpers ──────────────────────────────────────────────────────

VALID_MD = b"""# Python Basico

## Fundamentos

### Sintaxis
- Variables y tipos
- Condicionales
- [Docs Python](https://docs.python.org/3/)

### Funciones
- Definicion
- Argumentos
- Retorno

## Avanzado

### POO
- Clases
- Herencia
- Polimorfismo
"""

# Same structure as VALID_MD but as JSON
VALID_JSON = {
    "title": "Python Basico",
    "phases": [
        {
            "title": "Fundamentos",
            "topics": [
                {
                    "title": "Sintaxis",
                    "subtopics": [
                        {"title": "Variables y tipos"},
                        {"title": "Condicionales"},
                        {"title": "Docs Python", "url": "https://docs.python.org/3/"},
                    ],
                },
                {
                    "title": "Funciones",
                    "subtopics": [
                        {"title": "Definicion"},
                        {"title": "Argumentos"},
                        {"title": "Retorno"},
                    ],
                },
            ],
        },
        {
            "title": "Avanzado",
            "topics": [
                {
                    "title": "POO",
                    "subtopics": [
                        {"title": "Clases"},
                        {"title": "Herencia"},
                        {"title": "Polimorfismo"},
                    ],
                },
            ],
        },
    ],
}

# Expected counts (same for MD and JSON):
#   2 fases, 3 topics, 9 subtopics, 1 resource (the Docs Python link)
EXPECTED_PHASE_COUNT = 2
EXPECTED_TOPIC_COUNT = 3
EXPECTED_SUBTOPIC_COUNT = 9
EXPECTED_RESOURCE_COUNT = 1

# Accent palette (must match roadmap.py _ACCENT_PALETTE)
ACCENT_PALETTE = ["#3fb950", "#58a6ff", "#d29922", "#bc8cff", "#f78166"]


def _reload_app(monkeypatch, tmp_path, db_name: str = "bitacora-test-import.db"):
    """Reload the app with a fresh temp DB. Returns a TestClient."""
    db_path = tmp_path / db_name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("BITACORA_MODE", "selfhost")
    # The .env file has CORS_ORIGINS as comma-separated, but pydantic-settings
    # needs valid JSON for list[str]. Override to prevent parse error.
    monkeypatch.setenv("CORS_ORIGINS", '["http://localhost:3000"]')

    # Disable rate limiting for tests — the global limiter counter persists
    # across importlib.reload() calls, so test #3+ would hit 429.
    import functools
    import backend.security.rate_limit as rl_module
    rl_module.limiter.limit = lambda *a, **kw: lambda fn: fn

    import app.config as config_module
    import app.database as database_module
    import app.models.base as models_base_module
    import app.routers.roadmap as roadmap_router
    import app.routers.profile as profile_router
    import app.routers.chat as chat_router
    import app.services.seed as seed_module
    import app.main as main_module

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(database_module)
    importlib.reload(models_base_module)
    importlib.reload(roadmap_router)
    importlib.reload(profile_router)
    importlib.reload(chat_router)
    importlib.reload(seed_module)
    importlib.reload(main_module)

    database_module.init_db()
    return TestClient(main_module.app)


def _upload(client, content: bytes, filename: str, content_type: str = "text/markdown"):
    """Helper: POST /api/roadmaps/import with a file."""
    return client.post(
        "/api/roadmaps/import",
        files={"file": (filename, io.BytesIO(content), content_type)},
    )


# ── Tests: success cases ─────────────────────────────────────────

def test_valid_md_returns_201_with_correct_counts(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-md-valid.db")
    resp = _upload(client, VALID_MD, "test.md")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data["career_title"] == "Python Basico"
    assert data["phase_count"] == EXPECTED_PHASE_COUNT
    assert data["topic_count"] == EXPECTED_TOPIC_COUNT
    assert data["subtopic_count"] == EXPECTED_SUBTOPIC_COUNT
    assert data["resource_count"] == EXPECTED_RESOURCE_COUNT


def test_valid_json_returns_201_with_correct_counts(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-json-valid.db")
    content = json.dumps(VALID_JSON).encode("utf-8")
    resp = _upload(client, content, "test.json", "application/json")
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["ok"] is True
    assert data["career_title"] == "Python Basico"
    assert data["phase_count"] == EXPECTED_PHASE_COUNT
    assert data["topic_count"] == EXPECTED_TOPIC_COUNT
    assert data["subtopic_count"] == EXPECTED_SUBTOPIC_COUNT
    assert data["resource_count"] == EXPECTED_RESOURCE_COUNT


# ── Tests: error cases (400) ─────────────────────────────────────

def test_md_without_h1_returns_400(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-no-h1.db")
    bad_md = b"## Fase sin titulo\n### Topic\n- item"
    resp = _upload(client, bad_md, "sin-h1.md")
    assert resp.status_code == 400
    assert "titulo" in resp.json()["detail"].lower()


def test_md_with_multiple_h1_returns_400(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-multi-h1.db")
    bad_md = b"# Titulo Uno\n## Fase\n### Topic\n- item\n# Titulo Dos"
    resp = _upload(client, bad_md, "multi-h1.md")
    assert resp.status_code == 400
    detail = resp.json()["detail"].lower()
    assert "titulo" in detail or "h1" in detail


def test_unsupported_extension_returns_400(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-txt.db")
    resp = _upload(client, b"esto no es un roadmap", "invalid.txt", "text/plain")
    assert resp.status_code == 400
    assert "formato" in resp.json()["detail"].lower() or "soportado" in resp.json()["detail"].lower()


def test_empty_file_returns_400(monkeypatch, tmp_path):
    client = _reload_app(monkeypatch, tmp_path, "test-empty.db")
    resp = _upload(client, b"", "empty.md")
    assert resp.status_code == 400
    assert "vacio" in resp.json()["detail"].lower()


# ── Tests: persistence behavior ──────────────────────────────────

def test_career_created_with_is_active_false(monkeypatch, tmp_path):
    """The imported career must NOT become the active career."""
    client = _reload_app(monkeypatch, tmp_path, "test-inactive.db")

    # First, capture whatever the active career is before import
    before = client.get("/api/roadmaps/")
    active_id_before = before.json().get("id")

    # Import
    resp = _upload(client, VALID_MD, "test.md")
    assert resp.status_code == 201
    imported_id = resp.json()["career_id"]

    # The active career must NOT be the one we just imported
    after = client.get("/api/roadmaps/")
    active_id_after = after.json().get("id")

    assert active_id_after != imported_id, (
        f"Imported career (id={imported_id}) became active. "
        f"It must be created with is_active=False."
    )
    # Active career should be the same as before (unchanged)
    assert active_id_after == active_id_before


def test_accents_rotate_according_to_palette(monkeypatch, tmp_path):
    """Phases should get accents from _ACCENT_PALETTE cycled by index."""
    client = _reload_app(monkeypatch, tmp_path, "test-accents.db")

    # MD with 3 phases to see palette rotation
    md = b"""# Test Accents

## Fase 1
### Topic 1
- item

## Fase 2
### Topic 2
- item

## Fase 3
### Topic 3
- item
"""
    resp = _upload(client, md, "accents.md")
    assert resp.status_code == 201
    imported_id = resp.json()["career_id"]

    # Activate the imported career to read its phases
    patch = client.patch(f"/api/roadmaps/{imported_id}", params={"is_active": True})
    assert patch.status_code == 200

    phases = client.get("/api/roadmaps/phases").json()
    imported_phases = sorted(
        [p for p in phases if p["career_id"] == imported_id],
        key=lambda p: p["index"],
    )
    assert len(imported_phases) == 3

    assert imported_phases[0]["accent"] == ACCENT_PALETTE[0]
    assert imported_phases[1]["accent"] == ACCENT_PALETTE[1]
    assert imported_phases[2]["accent"] == ACCENT_PALETTE[2]
