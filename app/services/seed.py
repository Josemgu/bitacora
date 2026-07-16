"""Database seeding utilities.

This module provides a minimal `seed_if_empty` function used at startup.
It is intentionally lightweight to avoid side effects during container startup.
"""
from typing import Any


def seed_if_empty(db: Any) -> None:
    """Seed the database if it's empty.

    Current implementation is a no-op placeholder. Extend as needed.
    """
    # Placeholder: implement real seeding logic here if required.
    return
