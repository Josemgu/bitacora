"""
Input validation and sanitization helpers.

These guard against XSS (via HTML escaping), dangerous URL schemes
(javascript:, data:, file:), and unbounded input lengths.
"""
from __future__ import annotations

import html
import re
from urllib.parse import urlparse

# Only these URL schemes are ever allowed for user-supplied links.
_ALLOWED_URL_SCHEMES = {"http", "https"}

# Schemes that are explicitly dangerous in a browser context.
_DANGEROUS_SCHEMES = {"javascript", "data", "vbscript", "file"}

_SEARCH_QUERY_RE = re.compile(r"^[\w\s\-_.áéíóúñÁÉÍÓÚÑ]{0,100}$", re.UNICODE)


def sanitize_text(value: str | None, max_length: int | None = None) -> str | None:
    """Escape HTML-significant characters and optionally enforce a max length.

    Used as a defense-in-depth layer; the frontend must also avoid injecting
    raw values into innerHTML.
    """
    if value is None:
        return None
    cleaned = html.escape(value.strip(), quote=True)
    if max_length is not None:
        cleaned = cleaned[:max_length]
    return cleaned


def is_safe_url(url: str | None) -> bool:
    """Return True only for well-formed http(s) URLs with a host."""
    if not url:
        return False
    try:
        parsed = urlparse(url.strip())
    except ValueError:
        return False
    scheme = (parsed.scheme or "").lower()
    if scheme in _DANGEROUS_SCHEMES:
        return False
    if scheme not in _ALLOWED_URL_SCHEMES:
        return False
    if not parsed.netloc:
        return False
    return True


def validate_url(url: str | None, *, allow_empty: bool = False) -> str:
    """Validate and normalize a URL, raising ValueError when unsafe."""
    if not url:
        if allow_empty:
            return ""
        raise ValueError("URL is required")
    url = url.strip()
    if not is_safe_url(url):
        raise ValueError("URL must be a valid http(s) address")
    if len(url) > 1000:
        raise ValueError("URL exceeds maximum length of 1000 characters")
    return url


def validate_search_query(query: str | None) -> str | None:
    """Restrict free-text search to a safe, bounded character set."""
    if query is None:
        return None
    query = query.strip()
    if not query:
        return None
    if not _SEARCH_QUERY_RE.match(query):
        raise ValueError("Search query contains invalid characters")
    return query


def sanitize_filename(name: str | None) -> str | None:
    """Strip directory components and path-traversal sequences from a filename."""
    if not name:
        return None
    # Keep only the final path component and a safe character set.
    base = re.split(r"[\\/]", name)[-1]
    base = base.replace("..", "")
    base = re.sub(r"[^\w.\-]", "_", base)
    return base[:255] or None
