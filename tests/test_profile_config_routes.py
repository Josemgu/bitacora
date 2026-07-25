import importlib

from fastapi.testclient import TestClient


def test_profile_config_routes_exist(monkeypatch, tmp_path):
    db_path = tmp_path / "bitacora-test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")

    import app.config as config_module
    import app.database as database_module
    import app.models.base as models_base_module
    import app.routers.profile as profile_router
    import app.main as main_module

    config_module.get_settings.cache_clear()
    importlib.reload(config_module)
    importlib.reload(database_module)
    importlib.reload(models_base_module)
    importlib.reload(profile_router)
    importlib.reload(main_module)

    database_module.init_db()

    with TestClient(main_module.app) as client:
        get_resp = client.get("/api/profile/config")
        assert get_resp.status_code == 200
        payload = get_resp.json()
        assert payload["theme"] == "dark"
        assert payload["accent_color"] == "#3fb950"

        put_resp = client.put(
            "/api/profile/config",
            json={"theme": "light", "accent_color": "#58a6ff"},
        )
        assert put_resp.status_code == 200
        updated = put_resp.json()
        assert updated["theme"] == "light"
        assert updated["accent_color"] == "#58a6ff"
