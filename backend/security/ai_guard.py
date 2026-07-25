"""Defensive filters for AI-generated text before display or persistence."""

from __future__ import annotations

import re

# Common secret-like patterns that must never be echoed back to users.
_SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bghp_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\b(?:api[_-]?key|token|secret)\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{12,}[\"']?", re.IGNORECASE),
]

# SQL snippets that should not be surfaced if hallucinated by the model.
_SQL_BLOCK_RE = re.compile(r"```\s*sql[\s\S]*?```", re.IGNORECASE)
_RAW_SQL_RE = re.compile(
    r"\b(SELECT\s+.+\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|DROP\s+TABLE|ALTER\s+TABLE)\b",
    re.IGNORECASE,
)


def validate_ai_output(response_text: str) -> str:
    """Mask sensitive/token-like patterns and raw SQL snippets from model output."""
    if not response_text:
        return ""

    sanitized = response_text
    sanitized = _SQL_BLOCK_RE.sub("[REDACTED_SQL_BLOCK]", sanitized)
    sanitized = _RAW_SQL_RE.sub("[REDACTED_SQL_STATEMENT]", sanitized)

    for pattern in _SECRET_PATTERNS:
        sanitized = pattern.sub("[REDACTED_SECRET]", sanitized)

    return sanitized
