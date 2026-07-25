from __future__ import annotations

import pytest

from backend.security.ai_budget import AIBudgetGuard, BudgetExceededError
from backend.security.ai_guard import validate_ai_output


def test_ai_guard_masks_secrets_and_sql_hallucinations() -> None:
    leaked = """
    Resultado de auditoria universitaria:
    api_key: mock_key_dummy_placeholder_xyz987654
    token: neutral_token_placeholder_123456789
    ```sql
    SELECT email, password_hash FROM students WHERE is_admin = 1;
    ```
    """

    cleaned = validate_ai_output(leaked)

    assert "mock_key_dummy_placeholder_xyz987654" not in cleaned
    assert "neutral_token_placeholder_123456789" not in cleaned
    assert "SELECT email" not in cleaned
    assert "[REDACTED_SECRET]" in cleaned
    assert "[REDACTED_SQL_BLOCK]" in cleaned


def test_ai_budget_blocks_user_after_token_quota_exceeded() -> None:
    guard = AIBudgetGuard(daily_limit=4, session_limit=4)
    user_id = "student-42"
    session_id = "session-a"

    guard.check_and_consume(user_id=user_id, session_id=session_id, text="abcd" * 2)
    guard.check_and_consume(user_id=user_id, session_id=session_id, text="abcd")

    with pytest.raises(BudgetExceededError, match="budget exceeded"):
        guard.check_and_consume(user_id=user_id, session_id=session_id, text="abcd" * 2)
