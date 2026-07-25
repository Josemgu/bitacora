"""Rate limiting policies for Bitacora endpoints."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

# Base policies exported for route-level use.
standard_limit = "60/minute"
ai_limit = "5/minute"

# Dynamic limiter keyed by client IP.
limiter = Limiter(key_func=get_remote_address)
