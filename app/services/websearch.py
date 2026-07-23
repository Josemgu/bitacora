"""
Web search service — real internet search for learning resources.

Uses DuckDuckGo's HTML endpoint (no API key required). Results are parsed
with a tolerant regex (title + URL + snippet) and returned as plain dicts.
Network failures degrade to an empty list; they never raise to the caller.
"""
from __future__ import annotations

import logging
import re
import urllib.parse
from typing import Any, Dict, List

import httpx

from app.utils.validators import is_safe_url

logger = logging.getLogger("bitacora.websearch")

_DDG_URL = "https://html.duckduckgo.com/html/"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Bitacora-Discover/1.0",
    "Accept": "text/html",
}

_RESULT_RE = re.compile(
    r'<a[^>]+class="result__a"[^>]+href="(?P<href>[^"]+)"[^>]*>(?P<title>.*?)</a>',
    re.DOTALL,
)
_SNIPPET_RE = re.compile(
    r'<a[^>]+class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
    re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(html_text: str) -> str:
    text = _TAG_RE.sub("", html_text)
    text = (
        text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&#x27;", "'")
        .replace("&quot;", '"')
        .replace("&nbsp;", " ")
    )
    return " ".join(text.split()).strip()


def _decode_ddg_href(href: str) -> str:
    """DuckDuckGo wraps result URLs as //duckduckgo.com/l/?uddg=<encoded>."""
    if "uddg=" in href:
        try:
            qs = urllib.parse.urlparse(href).query
            params = urllib.parse.parse_qs(qs)
            target = params.get("uddg", [""])[0]
            if target:
                return urllib.parse.unquote(target)
        except Exception:
            pass
    if href.startswith("//"):
        return "https:" + href
    return href


def search_web(query: str, max_results: int = 10, timeout: float = 15.0) -> List[Dict[str, Any]]:
    """Search the web and return [{title, url, snippet}] (best-effort)."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        with httpx.Client(timeout=timeout, headers=_HEADERS, follow_redirects=True) as client:
            resp = client.post(_DDG_URL, data={"q": query})
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as e:
        logger.warning("web search failed for %r: %s", query, e)
        return []

    titles = list(_RESULT_RE.finditer(html))
    snippets = [m.group("snippet") for m in _SNIPPET_RE.finditer(html)]

    results: List[Dict[str, Any]] = []
    for i, m in enumerate(titles):
        url = _decode_ddg_href(m.group("href"))
        if not is_safe_url(url):
            continue
        title = _clean(m.group("title"))
        snippet = _clean(snippets[i]) if i < len(snippets) else ""
        if not title:
            continue
        results.append({"title": title[:300], "url": url[:1000], "snippet": snippet[:500]})
        if len(results) >= max_results:
            break
    return results


def search_learning_resources(topic: str, max_results: int = 8) -> List[Dict[str, Any]]:
    """Search tuned for learning material on a topic."""
    return search_web(f"{topic} tutorial documentation course", max_results=max_results)
