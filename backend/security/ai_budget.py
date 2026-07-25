"""Token budget guard to prevent API exhaustion and wallet denial attacks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from functools import wraps
from typing import Callable, TypeVar


class BudgetExceededError(ValueError):
    """Raised when token usage exceeds the configured budget."""


@dataclass
class BudgetCounter:
    daily_tokens: int = 0
    session_tokens: int = 0


class AIBudgetGuard:
    """In-memory budget guard for per-user per-session token limits."""

    def __init__(self, daily_limit: int = 15000, session_limit: int = 4000) -> None:
        self.daily_limit = daily_limit
        self.session_limit = session_limit
        self._counters: dict[tuple[str, str, date], BudgetCounter] = {}

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """Approximate tokens conservatively using character length."""
        if not text:
            return 0
        # Typical tokenization falls around 3-4 chars/token; floor at 1 token.
        return max(1, len(text) // 4)

    def _counter_for(self, user_id: str, session_id: str, today: date | None = None) -> BudgetCounter:
        day = today or date.today()
        key = (user_id, session_id, day)
        if key not in self._counters:
            self._counters[key] = BudgetCounter()
        return self._counters[key]

    def check_and_consume(self, user_id: str, session_id: str, text: str, today: date | None = None) -> int:
        """Consume estimated tokens or raise BudgetExceededError before execution."""
        needed = self.estimate_tokens(text)
        counter = self._counter_for(user_id=user_id, session_id=session_id, today=today)

        if counter.daily_tokens + needed > self.daily_limit:
            raise BudgetExceededError("Daily AI token budget exceeded")

        if counter.session_tokens + needed > self.session_limit:
            raise BudgetExceededError("Session AI token budget exceeded")

        counter.daily_tokens += needed
        counter.session_tokens += needed
        return needed


F = TypeVar("F", bound=Callable[..., object])


def enforce_ai_budget(guard: AIBudgetGuard) -> Callable[[F], F]:
    """Decorator to enforce token budget before executing an AI-bound handler."""

    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_id = kwargs.get("user_id")
            session_id = kwargs.get("session_id")
            text = kwargs.get("text", "")

            if not user_id or not session_id:
                raise ValueError("user_id and session_id are required for budget enforcement")

            guard.check_and_consume(user_id=user_id, session_id=session_id, text=text)
            return func(*args, **kwargs)

        return wrapper  # type: ignore[return-value]

    return decorator
