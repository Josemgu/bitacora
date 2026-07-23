"""
Roadmap sync & change-detection service (Sprint 2).

Two independent capabilities, both surfaced to the user through the mailbox:

1. Roadmap change detection
   Re-fetch a roadmap.sh roadmap, compute a stable *structural* hash (titles +
   resource URLs only, order-independent) and compare it against the hash stored
   on the Roadmap row. When the upstream roadmap changed we drop a
   ``roadmap_update`` mailbox item describing what moved, and remember the new
   hash so the same change is not reported twice.

2. Link health checking
   Probe the URLs attached to resources / subtopic-resources, classify each as
   ``ok`` / ``redirect`` / ``broken`` and, when a link that used to work breaks,
   drop a ``broken_link`` mailbox item. Results are de-duplicated so a link that
   is already flagged as broken does not generate a new notification on every run.

All network access is best-effort: failures degrade to ``unknown`` and never
raise out of the service, so a blocked egress proxy can never crash a request.
"""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from app.models.base import (
    LinkStatus,
    MailboxItem,
    MailboxKind,
    MailboxStatus,
    Resource,
    Roadmap,
    RoadmapSource,
    SubtopicResource,
)
from app.utils.validators import is_safe_url

logger = logging.getLogger("bitacora.roadmap_sync")

# Only these mailbox statuses count as "still open" when de-duplicating.
_OPEN_STATUSES = (MailboxStatus.unread, MailboxStatus.read)


# ──────────────────────────────────────────────────────────────────────
# Structural hashing
# ──────────────────────────────────────────────────────────────────────

def _canonical_structure(roadmap_data: dict[str, Any]) -> list[Any]:
    """Reduce a parsed roadmap to a canonical, order-independent shape.

    Only the fields that define the *learning content* are kept (titles and
    resource URLs). Cosmetic fields (colors, descriptions) are ignored so a
    palette tweak upstream does not read as a content change.
    """
    phases = []
    for phase in roadmap_data.get("phases", []):
        topics = []
        for topic in phase.get("topics", []):
            subtopics = []
            for sub in topic.get("subtopics", []):
                urls = sorted(
                    (r.get("url", "") or "").strip()
                    for r in sub.get("resources", [])
                )
                subtopics.append([(sub.get("title", "") or "").strip(), urls])
            subtopics.sort()
            topics.append([(topic.get("title", "") or "").strip(), subtopics])
        topics.sort()
        phases.append([(phase.get("title", "") or "").strip(), topics])
    phases.sort()
    return phases


def compute_structure_hash(roadmap_data: dict[str, Any]) -> str:
    """SHA-256 of the canonical structure — stable across reordering."""
    canonical = _canonical_structure(roadmap_data)
    blob = json.dumps(canonical, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def summarize_structure(roadmap_data: dict[str, Any]) -> dict[str, int]:
    """Counts used to describe a change in human terms."""
    phases = roadmap_data.get("phases", [])
    topics = sum(len(p.get("topics", [])) for p in phases)
    subtopics = sum(
        len(t.get("subtopics", []))
        for p in phases
        for t in p.get("topics", [])
    )
    return {"phases": len(phases), "topics": topics, "subtopics": subtopics}


def _diff_message(old: Optional[dict[str, int]], new: dict[str, int]) -> str:
    """Human-readable delta between two structure summaries."""
    if not old:
        return (
            f"Estructura actual: {new['phases']} fases, {new['topics']} temas, "
            f"{new['subtopics']} subtemas."
        )
    parts = []
    for key, label in (("phases", "fases"), ("topics", "temas"), ("subtopics", "subtemas")):
        delta = new[key] - old.get(key, 0)
        if delta > 0:
            parts.append(f"+{delta} {label}")
        elif delta < 0:
            parts.append(f"{delta} {label}")
    if not parts:
        return "El contenido cambió (mismo número de elementos, distintos títulos o recursos)."
    return "Cambios detectados: " + ", ".join(parts) + "."


# ──────────────────────────────────────────────────────────────────────
# Roadmap change detection
# ──────────────────────────────────────────────────────────────────────

def sync_roadmap_from_source(
    db: Session,
    roadmap: Roadmap,
    *,
    parser,
    fetch_timeout: float = 30.0,
) -> dict[str, Any]:
    """Check a roadmap.sh-sourced roadmap for upstream changes.

    ``parser`` is a callable ``(html, source_ref) -> parsed_dict`` (the router
    passes its own ``_parse_roadmap_sh_html`` to avoid a circular import).

    Returns a dict describing the outcome; never raises.
    """
    if roadmap.source != RoadmapSource.roadmapsh or not roadmap.source_ref:
        return {"synced": False, "reason": "Roadmap no proviene de roadmap.sh."}

    url = f"https://roadmap.sh/{roadmap.source_ref}"
    if not is_safe_url(url):
        return {"synced": False, "reason": "URL de origen no válida."}

    try:
        with httpx.Client(timeout=fetch_timeout, follow_redirects=True) as client:
            resp = client.get(url)
            resp.raise_for_status()
            parsed = parser(resp.text, roadmap.source_ref)
    except Exception as exc:  # network / parse — degrade gracefully
        logger.warning("roadmap sync fetch failed for %s: %s", roadmap.source_ref, exc)
        return {"synced": False, "reason": f"No se pudo consultar el origen: {exc}"}

    if not parsed:
        return {"synced": False, "reason": "No se pudo interpretar el roadmap de origen."}

    new_hash = compute_structure_hash(parsed)
    new_summary = summarize_structure(parsed)
    old_summary: Optional[dict[str, int]] = None
    if roadmap.source_metadata:
        try:
            old_summary = json.loads(roadmap.source_metadata).get("summary")
        except (json.JSONDecodeError, AttributeError):
            old_summary = None

    changed = bool(roadmap.version_hash) and roadmap.version_hash != new_hash
    first_sync = roadmap.version_hash is None

    # Persist the new fingerprint regardless of outcome.
    roadmap.version_hash = new_hash
    roadmap.last_sync_at = datetime.utcnow()
    roadmap.source_metadata = json.dumps({"summary": new_summary}, ensure_ascii=False)

    notified = False
    if changed:
        _notify_roadmap_changed(db, roadmap, old_summary, new_summary, url)
        notified = True

    db.commit()
    return {
        "synced": True,
        "changed": changed,
        "first_sync": first_sync,
        "notified": notified,
        "summary": new_summary,
        "version_hash": new_hash,
    }


def _notify_roadmap_changed(
    db: Session,
    roadmap: Roadmap,
    old_summary: Optional[dict[str, int]],
    new_summary: dict[str, int],
    url: str,
) -> None:
    body = (
        f"El roadmap «{roadmap.title}» cambió en roadmap.sh.\n\n"
        f"{_diff_message(old_summary, new_summary)}\n\n"
        f"Puedes re-importarlo para incorporar los cambios."
    )
    db.add(MailboxItem(
        kind=MailboxKind.roadmap_update,
        subject=f"Actualización de roadmap: {roadmap.title}",
        body=body,
        related_id=roadmap.id,
        is_actionable=True,
        action_url=url,
        status=MailboxStatus.unread,
    ))


# ──────────────────────────────────────────────────────────────────────
# Link health checking
# ──────────────────────────────────────────────────────────────────────

def _probe_url(client: httpx.Client, url: str) -> LinkStatus:
    """Classify a single URL. HEAD first, fall back to GET (some hosts 405 HEAD)."""
    try:
        resp = client.head(url, follow_redirects=False)
        if resp.status_code in (405, 403, 501):
            resp = client.get(url, follow_redirects=False)
        code = resp.status_code
        if 200 <= code < 300:
            return LinkStatus.ok
        if 300 <= code < 400:
            return LinkStatus.redirect
        return LinkStatus.broken
    except Exception:
        return LinkStatus.broken


def _has_open_broken_notice(db: Session, url: str) -> bool:
    return db.query(MailboxItem).filter(
        MailboxItem.kind == MailboxKind.broken_link,
        MailboxItem.action_url == url,
        MailboxItem.status.in_(_OPEN_STATUSES),
    ).first() is not None


def check_links(
    db: Session,
    *,
    limit: int = 200,
    timeout: float = 10.0,
) -> dict[str, Any]:
    """Probe resource links, persist status on ``Resource`` rows, and notify
    on newly-broken links (de-duplicated against still-open mailbox items).
    """
    checked = 0
    broken = 0
    redirects = 0
    notified = 0
    now = datetime.utcnow()

    with httpx.Client(
        timeout=timeout,
        follow_redirects=False,
        headers={"User-Agent": "Bitacora-LinkChecker/1.0"},
    ) as client:
        # 1. Catalogued resources (have persistent link_status).
        resources = (
            db.query(Resource)
            .filter(Resource.url.isnot(None))
            .limit(limit)
            .all()
        )
        for res in resources:
            url = (res.url or "").strip()
            if not url or not is_safe_url(url):
                continue
            previous = res.link_status
            status = _probe_url(client, url)
            res.link_status = status
            res.link_checked_at = now
            checked += 1
            if status == LinkStatus.redirect:
                redirects += 1
            if status == LinkStatus.broken:
                broken += 1
                # Notify only on transition into broken, and only once.
                if previous != LinkStatus.broken and not _has_open_broken_notice(db, url):
                    _notify_broken_link(db, res.title, url, res.id)
                    notified += 1

        # 2. Subtopic resources (no persistent status field — notify + dedupe).
        remaining = max(0, limit - checked)
        if remaining:
            sub_resources = (
                db.query(SubtopicResource)
                .filter(SubtopicResource.url.isnot(None))
                .limit(remaining)
                .all()
            )
            for sr in sub_resources:
                url = (sr.url or "").strip()
                if not url or not is_safe_url(url):
                    continue
                status = _probe_url(client, url)
                checked += 1
                if status == LinkStatus.redirect:
                    redirects += 1
                if status == LinkStatus.broken:
                    broken += 1
                    if not _has_open_broken_notice(db, url):
                        _notify_broken_link(db, sr.label, url, sr.id)
                        notified += 1

    db.commit()
    return {
        "checked": checked,
        "broken": broken,
        "redirects": redirects,
        "notified": notified,
    }


def _notify_broken_link(db: Session, label: str, url: str, related_id: int) -> None:
    db.add(MailboxItem(
        kind=MailboxKind.broken_link,
        subject=f"Enlace roto: {label}"[:400],
        body=(
            f"El recurso «{label}» apunta a un enlace que ya no responde:\n{url}\n\n"
            f"Considera actualizarlo o reemplazarlo."
        ),
        related_id=related_id,
        is_actionable=True,
        action_url=url,
        status=MailboxStatus.unread,
    ))
