from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.security.rate_limit import ai_limit, limiter, standard_limit


def test_standard_policy_blocks_bruteforce_after_60_requests() -> None:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.get("/student/roadmap")
    @limiter.limit(standard_limit)
    def student_roadmap(request: Request) -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)

    for _ in range(60):
        response = client.get("/student/roadmap")
        assert response.status_code == 200

    blocked = client.get("/student/roadmap")
    assert blocked.status_code == 429
    assert "Rate limit exceeded" in blocked.text


def test_ai_policy_blocks_on_sixth_request() -> None:
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.get("/ai/high-cost")
    @limiter.limit(ai_limit)
    def high_cost_ai_endpoint(request: Request) -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)

    for _ in range(5):
        response = client.get("/ai/high-cost")
        assert response.status_code == 200

    blocked = client.get("/ai/high-cost")
    assert blocked.status_code == 429
    assert "Rate limit exceeded" in blocked.text
