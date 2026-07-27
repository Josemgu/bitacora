"""
Generic roadmap parser: Markdown and JSON -> CareerImportData.

The parser validates strict hierarchy and reports warnings for
ignored lines (case h). Returns either a CareerImportData or an
error string -- never raises.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional, Tuple

from backend.schemas.roadmap_import import (
    CareerImportData,
    PhaseImportData,
    TopicImportData,
    SubtopicImportData,
)

# ──────────────── Limits ────────────────

MAX_FILE_SIZE = 1 * 1024 * 1024       # 1 MB
MAX_PHASES = 50
MAX_TOPICS_PER_PHASE = 100
MAX_SUBTOPICS_PER_TOPIC = 200

# ──────────────── Public API ────────────────

def parse_import(content: str, filename: str) -> Tuple[Optional[CareerImportData], Optional[str], List[str]]:
    """
    Detect format by extension and parse.

    Returns:
        (data, None, warnings)  on success
        (None, error, [])       on failure
    """
    # Strip UTF-8 BOM if present (some editors/OS add it automatically)
    if content and content[0] == "\ufeff":
        content = content[1:]

    name_lower = filename.lower()
    if name_lower.endswith(".json"):
        return _parse_json(content, filename)
    elif name_lower.endswith(".md") or name_lower.endswith(".markdown"):
        return _parse_markdown(content, filename)
    else:
        return None, f"Formato no soportado: '{filename}'. Use archivos .md o .json.", []

# ──────────────── Markdown parser ────────────────

_H1_RE = re.compile(r"^# (.+)$")
_H2_RE = re.compile(r"^## (.+)$")
_H3_RE = re.compile(r"^### (.+)$")
# Uses [^()]+ for URL to allow parentheses inside (e.g. Wikipedia links).
_LIST_LINK_RE = re.compile(r"^- \[([^\]]+)\]\(([^()]+(?:\([^()]*\)[^()]*)*)\)\s*$")
_LIST_ITEM_RE = re.compile(r"^-\s+(.+)$")
_LIST_LINK_PREFIX_RE = re.compile(r"^- \[")
_BLANK_RE = re.compile(r"^\s*$")


def _flush_topic(
    current_topic: str,
    current_topic_line: int,
    current_subtopics: List[SubtopicImportData],
    topics_in_current_phase: int,
    current_topics: List[TopicImportData],
    max_topics: int,
    phase_title: Optional[str],
    phase_line: Optional[int],
) -> Tuple[int, str]:
    """
    Flush the pending topic into current_topics.
    Returns (updated topics_in_current_phase, "") on success.
    Returns (unchanged, error_message) if MAX_TOPICS_PER_PHASE exceeded.
    """
    if topics_in_current_phase >= max_topics:
        return topics_in_current_phase, (
            f"La fase '{phase_title}' (linea {phase_line}) "
            f"excede el limite de {max_topics} topics."
        )
    current_topics.append(TopicImportData(
        title=current_topic,
        order=topics_in_current_phase,
        subtopics=current_subtopics,
    ))
    return topics_in_current_phase + 1, ""


def _parse_markdown(content: str, filename: str) -> Tuple[Optional[CareerImportData], Optional[str], List[str]]:
    warnings: List[str] = []

    # --- Size check ---
    if len(content.encode("utf-8")) > MAX_FILE_SIZE:
        return None, f"Archivo excede el limite de {MAX_FILE_SIZE // (1024*1024)} MB.", []

    lines = content.splitlines()
    if not lines or all(_BLANK_RE.match(line) for line in lines):
        return None, "El archivo esta vacio.", []

    # --- Accumulators ---
    title: Optional[str] = None
    h1_count = 0

    current_phase: Optional[str] = None
    current_phase_line: Optional[int] = None
    current_topics: List[TopicImportData] = []
    topics_in_current_phase = 0

    current_topic: Optional[str] = None
    current_topic_line: Optional[int] = None
    current_subtopics: List[SubtopicImportData] = []
    subtopics_in_current_topic = 0

    phases: List[PhaseImportData] = []
    phase_count = 0

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Skip blanks
        if _BLANK_RE.match(stripped):
            continue

        # ── H1 ──
        m = _H1_RE.match(stripped)
        if m:
            h1_count += 1
            if h1_count > 1:
                return None, (
                    f"Se encontraron {h1_count} titulos de carrera "
                    f"(lineas con '# '). Debe haber exactamente uno."
                ), []
            title = m.group(1).strip()
            continue

        # ── H2 ──
        m = _H2_RE.match(stripped)
        if m:
            # Flush pending topic FIRST (bug critical fix)
            if current_topic is not None:
                topics_in_current_phase, err = _flush_topic(
                    current_topic, current_topic_line, current_subtopics,
                    topics_in_current_phase, current_topics,
                    MAX_TOPICS_PER_PHASE, current_phase, current_phase_line,
                )
                if err:
                    return None, err, []
                current_topic = None
                current_topic_line = None
                current_subtopics = []
                subtopics_in_current_topic = 0

            # Validate previous phase had at least one topic
            if current_phase is not None and topics_in_current_phase == 0:
                return None, (
                    f"La fase '{current_phase}' (linea {current_phase_line}) "
                    f"no contiene ningun topic (### ). "
                    f"Toda fase debe tener al menos un topic."
                ), []

            # Flush previous phase
            if current_phase is not None:
                if phase_count >= MAX_PHASES:
                    return None, f"El archivo excede el limite de {MAX_PHASES} fases.", []
                phases.append(PhaseImportData(
                    title=current_phase,
                    index=phase_count,
                    topics=current_topics,
                ))
                phase_count += 1

            current_phase = m.group(1).strip()
            current_phase_line = line_num
            current_topics = []
            topics_in_current_phase = 0
            continue

        # ── H3 ──
        m = _H3_RE.match(stripped)
        if m:
            if current_phase is None:
                return None, (
                    f"El topic '{stripped}' (linea {line_num}) aparece "
                    f"antes de cualquier fase. Los topics deben estar "
                    f"dentro de una fase (## )."
                ), []

            # Flush previous topic within this phase
            if current_topic is not None:
                topics_in_current_phase, err = _flush_topic(
                    current_topic, current_topic_line, current_subtopics,
                    topics_in_current_phase, current_topics,
                    MAX_TOPICS_PER_PHASE, current_phase, current_phase_line,
                )
                if err:
                    return None, err, []
                current_topic = None
                current_topic_line = None
                current_subtopics = []
                subtopics_in_current_topic = 0

            current_topic = m.group(1).strip()
            current_topic_line = line_num
            continue

        # ── List item with link: - [Label](url) ──
        m = _LIST_LINK_RE.match(stripped)
        if m:
            if current_topic is None:
                return None, (
                    f"El subtopic '{m.group(1)}' (linea {line_num}) aparece "
                    f"antes de cualquier topic. Los items de lista deben "
                    f"estar dentro de un topic (### )."
                ), []

            subtopics_in_current_topic += 1
            if subtopics_in_current_topic > MAX_SUBTOPICS_PER_TOPIC:
                return None, (
                    f"El topic '{current_topic}' (linea {current_topic_line}) "
                    f"excede el limite de {MAX_SUBTOPICS_PER_TOPIC} subtopics."
                ), []

            current_subtopics.append(SubtopicImportData(
                title=m.group(1).strip(),
                order=subtopics_in_current_topic - 1,
                resource_label=m.group(1).strip(),
                resource_url=m.group(2).strip(),
            ))
            continue

        # ── Malformed link: starts with "- [" but didn't match above ──
        if _LIST_LINK_PREFIX_RE.match(stripped):
            display = stripped[:60] + "..." if len(stripped) > 60 else stripped
            warnings.append(
                f"Linea {line_num} ignorada (enlace malformado): '{display}'. "
                f"Use el formato: - [texto](https://url)"
            )
            continue

        # ── Plain list item: - Texto ──
        m = _LIST_ITEM_RE.match(stripped)
        if m:
            if current_topic is None:
                return None, (
                    f"El subtopic '{m.group(1).strip()}' (linea {line_num}) "
                    f"aparece antes de cualquier topic. Los items de lista "
                    f"deben estar dentro de un topic (### )."
                ), []

            subtopics_in_current_topic += 1
            if subtopics_in_current_topic > MAX_SUBTOPICS_PER_TOPIC:
                return None, (
                    f"El topic '{current_topic}' (linea {current_topic_line}) "
                    f"excede el limite de {MAX_SUBTOPICS_PER_TOPIC} subtopics."
                ), []

            # NOTE: nested lists (e.g. "- Sub-item" indented under a parent "-")
            # are flattened -- the .strip() above removes all indentation.
            # This is INTENTIONAL: the MD format does not support nested
            # subtopic hierarchy. Indented items become top-level subtopics
            # of the current ### heading.
            current_subtopics.append(SubtopicImportData(
                title=m.group(1).strip(),
                order=subtopics_in_current_topic - 1,
            ))
            continue

        # Case h: ignored line (not heading, not list)
        display = stripped[:60] + "..." if len(stripped) > 60 else stripped
        warnings.append(f"Linea {line_num} ignorada (no es heading ni lista): '{display}'")

    # ─── Post-loop flush ───

    # No title found
    if title is None:
        return None, (
            "El archivo no contiene un titulo de carrera "
            "(linea que empiece con '# '). El primer elemento del archivo "
            "debe ser '# Nombre de la carrera'."
        ), []

    # Flush last topic (bug minor 1 fix: check limit)
    if current_topic is not None:
        if topics_in_current_phase >= MAX_TOPICS_PER_PHASE:
            return None, (
                f"La fase '{current_phase}' (linea {current_phase_line}) "
                f"excede el limite de {MAX_TOPICS_PER_PHASE} topics."
            ), []
        current_topics.append(TopicImportData(
            title=current_topic,
            order=topics_in_current_phase,
            subtopics=current_subtopics,
        ))
        topics_in_current_phase += 1

    # Flush last phase
    if current_phase is not None:
        if topics_in_current_phase == 0:
            return None, (
                f"La fase '{current_phase}' (linea {current_phase_line}) "
                f"no contiene ningun topic (### ). "
                f"Toda fase debe tener al menos un topic."
            ), []
        if phase_count >= MAX_PHASES:
            return None, f"El archivo excede el limite de {MAX_PHASES} fases.", []
        phases.append(PhaseImportData(
            title=current_phase,
            index=phase_count,
            topics=current_topics,
        ))
        phase_count += 1

    # Edge case (i): no phases parsed at all
    if phase_count == 0:
        return None, (
            "El archivo no contiene ninguna fase (## ). "
            "Debe haber al menos una fase con topics."
        ), []

    return CareerImportData(
        title=title,
        source_ref=filename,
        phases=phases,
    ), None, warnings


# ──────────────── JSON parser ────────────────

def _parse_json(content: str, filename: str) -> Tuple[Optional[CareerImportData], Optional[str], List[str]]:
    warnings: List[str] = []

    # Size check
    if len(content.encode("utf-8")) > MAX_FILE_SIZE:
        return None, f"Archivo excede el limite de {MAX_FILE_SIZE // (1024*1024)} MB.", []

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return None, f"JSON invalido: {e}", []

    if not isinstance(data, dict):
        return None, "El JSON debe ser un objeto (dict), no una lista o valor simple.", []

    # Title
    title = data.get("title")
    if not title or not isinstance(title, str) or not title.strip():
        return None, "Falta el campo 'title' (string no vacio) en el JSON raiz.", []
    title = title.strip()

    # Phases
    raw_phases = data.get("phases")
    if not isinstance(raw_phases, list) or len(raw_phases) == 0:
        return None, "Falta el campo 'phases' o esta vacio. Debe ser un array con al menos una fase.", []

    if len(raw_phases) > MAX_PHASES:
        return None, f"El JSON excede el limite de {MAX_PHASES} fases.", []

    phases: List[PhaseImportData] = []

    for p_idx, raw_phase in enumerate(raw_phases):
        if not isinstance(raw_phase, dict):
            return None, f"La fase en posicion {p_idx} no es un objeto.", []

        phase_title = raw_phase.get("title")
        if not phase_title or not isinstance(phase_title, str) or not phase_title.strip():
            return None, f"La fase en posicion {p_idx} no tiene 'title'.", []

        raw_topics = raw_phase.get("topics")
        if not isinstance(raw_topics, list) or len(raw_topics) == 0:
            return None, f"La fase '{phase_title.strip()}' no tiene 'topics' o esta vacia.", []

        if len(raw_topics) > MAX_TOPICS_PER_PHASE:
            return None, f"La fase '{phase_title.strip()}' excede el limite de {MAX_TOPICS_PER_PHASE} topics.", []

        topics: List[TopicImportData] = []

        for t_idx, raw_topic in enumerate(raw_topics):
            if not isinstance(raw_topic, dict):
                return None, f"El topic en posicion {t_idx} de la fase '{phase_title.strip()}' no es un objeto.", []

            topic_title = raw_topic.get("title")
            if not topic_title or not isinstance(topic_title, str) or not topic_title.strip():
                return None, f"El topic en posicion {t_idx} de la fase '{phase_title.strip()}' no tiene 'title'.", []

            raw_subtopics = raw_topic.get("subtopics", [])
            if not isinstance(raw_subtopics, list):
                return None, f"El topic '{topic_title.strip()}' tiene campo 'subtopics' que no es un array.", []

            if len(raw_subtopics) > MAX_SUBTOPICS_PER_TOPIC:
                return None, f"El topic '{topic_title.strip()}' excede el limite de {MAX_SUBTOPICS_PER_TOPIC} subtopics.", []

            subtopics: List[SubtopicImportData] = []

            for s_idx, raw_sub in enumerate(raw_subtopics):
                if not isinstance(raw_sub, dict):
                    return None, f"El subtopic en posicion {s_idx} del topic '{topic_title.strip()}' no es un objeto.", []

                sub_title = raw_sub.get("title")
                if not sub_title or not isinstance(sub_title, str) or not sub_title.strip():
                    return None, f"El subtopic en posicion {s_idx} del topic '{topic_title.strip()}' no tiene 'title'.", []

                sub_url = raw_sub.get("url")
                subtopics.append(SubtopicImportData(
                    title=sub_title.strip(),
                    order=s_idx,
                    resource_label=sub_title.strip() if sub_url else None,
                    resource_url=sub_url.strip() if isinstance(sub_url, str) and sub_url.strip() else None,
                ))

            topics.append(TopicImportData(
                title=topic_title.strip(),
                order=t_idx,
                subtopics=subtopics,
            ))

        phases.append(PhaseImportData(
            title=phase_title.strip(),
            index=p_idx,
            topics=topics,
        ))

    return CareerImportData(
        title=title,
        source_ref=filename,
        phases=phases,
    ), None, warnings