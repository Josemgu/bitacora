"""
AI Service Module for Bitácora.

Talks to the configured AIProvider over plain HTTPS (httpx) — no vendor SDKs.
Supported provider slugs/endpoints:
  - "anthropic"  → Anthropic Messages API (https://api.anthropic.com/v1/messages)
  - "ollama" or is_local → OpenAI-compatible chat completions on the local endpoint
  - anything else → OpenAI-compatible /v1/chat/completions on provider.endpoint

The API key is resolved in this order:
  1. provider.api_key_encrypted (decrypted with the app's Fernet key)
  2. the environment variable named by provider.api_key_env_var
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from app.models.base import AIProvider
from app.utils.security import decrypt_secret

logger = logging.getLogger("bitacora.ai")

DEFAULT_TIMEOUT = 60.0


class AIServiceError(RuntimeError):
    """Raised when the AI provider call fails in a way the caller should see."""


def resolve_api_key(provider: AIProvider) -> Optional[str]:
    """Resolve the provider's API key without ever exposing it in responses."""
    if provider.api_key_encrypted:
        try:
            return decrypt_secret(provider.api_key_encrypted)
        except Exception:
            logger.error("Could not decrypt stored API key for provider %s", provider.slug)
    if provider.api_key_env_var:
        return os.environ.get(provider.api_key_env_var)
    return None


def _is_anthropic(provider: AIProvider) -> bool:
    slug = (provider.slug or "").lower()
    endpoint = (provider.endpoint or "").lower()
    return "anthropic" in slug or "anthropic" in endpoint


def _split_system(messages: List[Dict[str, str]]) -> tuple[Optional[str], List[Dict[str, str]]]:
    """Separate the system prompt from the chat turns (Anthropic format)."""
    system = None
    turns = []
    for m in messages:
        if m.get("role") == "system":
            system = (system + "\n" + m["content"]) if system else m["content"]
        else:
            turns.append({"role": m["role"], "content": m["content"]})
    return system, turns


def call_ai(
    provider: AIProvider,
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    max_tokens: int = 4000,
    temperature: float = 0.7,
) -> str:
    """Send a chat request to the provider and return the assistant text."""
    api_key = resolve_api_key(provider)
    timeout = float(provider.timeout_seconds or DEFAULT_TIMEOUT)

    if _is_anthropic(provider):
        if not api_key:
            raise AIServiceError(
                "El proveedor Anthropic no tiene API key configurada "
                "(agrega la clave o define la variable de entorno)."
            )
        model_name = model or provider.default_model or "claude-sonnet-5"
        url = (provider.endpoint or "https://api.anthropic.com").rstrip("/")
        if not url.endswith("/v1/messages"):
            url = url + "/v1/messages"
        system, turns = _split_system(messages)
        payload: Dict[str, Any] = {
            "model": model_name,
            "max_tokens": max_tokens,
            "messages": turns,
        }
        if system:
            payload["system"] = system
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
            parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
            return "".join(parts)
        except httpx.HTTPStatusError as e:
            detail = e.response.text[:300]
            logger.error("Anthropic call failed (%s): %s", e.response.status_code, detail)
            raise AIServiceError(f"Proveedor Anthropic respondió {e.response.status_code}.") from e
        except httpx.HTTPError as e:
            raise AIServiceError(f"No se pudo contactar al proveedor: {e}") from e

    # OpenAI-compatible (OpenAI, Ollama, LM Studio, etc.)
    base = (provider.endpoint or "").rstrip("/")
    if not base:
        base = "http://localhost:11434/v1" if provider.is_local else "https://api.openai.com/v1"
    url = base + ("/chat/completions" if not base.endswith("/chat/completions") else "")
    model_name = model or provider.default_model or ("llama3" if provider.is_local else "gpt-4o-mini")
    headers = {"content-type": "application/json"}
    if api_key:
        headers["authorization"] = f"Bearer {api_key}"
    elif not provider.is_local:
        raise AIServiceError(
            f"El proveedor {provider.name} no tiene API key configurada."
        )
    payload = {
        "model": model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        return data["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        logger.error("AI call failed (%s): %s", e.response.status_code, e.response.text[:300])
        raise AIServiceError(f"El proveedor respondió {e.response.status_code}.") from e
    except (httpx.HTTPError, KeyError, IndexError) as e:
        raise AIServiceError(f"No se pudo obtener respuesta del proveedor: {e}") from e


# Backwards-compatible alias used by roadmap.py
_call_ai = call_ai


def _extract_json(text: str) -> Any:
    """Parse JSON out of an AI reply, tolerating markdown fences."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Last resort: slice from first { or [ to matching end
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
        if start == -1:
            raise
        return json.loads(text[start:])


def chat_reply(
    provider: AIProvider,
    history: List[Dict[str, str]],
    user_message: str,
    context: Optional[str] = None,
) -> str:
    """Conversational reply for the Bitácora chat (the AI professor)."""
    system = (
        "Eres el profesor y mentor de Bitácora, una plataforma personal de aprendizaje. "
        "Ayudas al estudiante con su roadmap de aprendizaje: explicas temas, recomiendas "
        "recursos, propones ejercicios y proyectos, y respondes en español de forma clara "
        "y motivadora. Sé concreto y práctico."
    )
    if context:
        system += f"\n\nContexto actual del estudiante:\n{context}"
    messages: List[Dict[str, str]] = [{"role": "system", "content": system}]
    messages.extend(history[-20:])
    messages.append({"role": "user", "content": user_message})
    return call_ai(provider, messages, max_tokens=1500)


def generate_resource_suggestions(
    provider: AIProvider,
    career_path: str,
    phase_titles: List[str],
    topic_titles: List[str],
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """AI-suggested learning resources for a career path + roadmap structure."""
    system_prompt = (
        "You are an expert technical curriculum designer. Suggest high-quality, real, "
        "currently-maintained learning resources (official docs, free courses, videos, labs). "
        'Return ONLY a JSON array of objects with keys: "title", "url", "category" '
        '(docs|video|lab|article|tool|other), "description", "phase", "topic".'
    )
    ctx = f"Career path: {career_path}\nPhases: {', '.join(phase_titles[:10])}\n"
    ctx += f"Topics: {', '.join(topic_titles[:25])}"
    user_prompt = ctx + "\n\nGenerate 12-18 resources distributed across these phases/topics. JSON array only."

    try:
        raw = call_ai(
            provider,
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            model=model,
            max_tokens=4000,
        )
        items = _extract_json(raw)
        out = []
        for r in items if isinstance(items, list) else []:
            if isinstance(r, dict) and r.get("title") and r.get("url"):
                out.append({
                    "title": str(r.get("title"))[:300],
                    "url": str(r.get("url"))[:1000],
                    "category": r.get("category", "article"),
                    "description": str(r.get("description", ""))[:500],
                    "phase": r.get("phase", ""),
                    "topic": r.get("topic", ""),
                })
        return out
    except (AIServiceError, json.JSONDecodeError) as e:
        logger.error("AI resource suggestion failed: %s", e)
        return []


def enhance_roadmap_with_ai(
    provider: AIProvider,
    roadmap_data: Dict[str, Any],
    career_path: str,
) -> Dict[str, Any]:
    """Enrich a parsed roadmap with career-specific subtopics/resources."""
    system_prompt = (
        "You are an expert curriculum designer. Enhance the given roadmap JSON for the "
        "career path: add specific subtopics and resource URLs. Keep the exact same JSON "
        "structure; only add content. Return ONLY valid JSON."
    )
    user_prompt = (
        f"Career path: {career_path}\n\nRoadmap:\n{json.dumps(roadmap_data, ensure_ascii=False)[:12000]}"
        "\n\nReturn the enhanced roadmap JSON."
    )
    try:
        raw = call_ai(
            provider,
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            max_tokens=6000,
        )
        enhanced = _extract_json(raw)
        if isinstance(enhanced, dict) and enhanced.get("phases"):
            return enhanced
        return roadmap_data
    except (AIServiceError, json.JSONDecodeError) as e:
        logger.error("AI roadmap enhancement failed: %s", e)
        return roadmap_data


def generate_roadmap_from_scratch(
    provider: AIProvider,
    career_path: str,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate a full roadmap (phases → topics → subtopics → resources) for a career."""
    system_prompt = (
        "You are an expert curriculum designer. Generate a complete learning roadmap as JSON:\n"
        '{"title": str, "description": str, "phases": [{"title": str, "description": str, '
        '"color": "#hex", "topics": [{"title": str, "subtopics": [{"title": str, '
        '"description": str, "resources": [{"label": str, "url": str}]}]}]}]}\n'
        "4-6 phases, 3-5 topics each, 2-4 subtopics per topic, 1-3 real resource URLs per "
        "subtopic (official docs, free courses). Titles in Spanish where natural. "
        "Return ONLY valid JSON."
    )
    user_prompt = f"Generate the roadmap for the career path: {career_path}"
    raw = call_ai(
        provider,
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        model=model,
        max_tokens=8000,
    )
    data = _extract_json(raw)
    if not isinstance(data, dict) or not data.get("phases"):
        raise AIServiceError("La IA no devolvió un roadmap válido.")
    return data


def generate_project_for_phase(
    provider: AIProvider,
    phase_title: str,
    topic_titles: List[str],
    career_path: str = "",
) -> Dict[str, Any]:
    """Generate a practice project (with checklist) for a roadmap phase."""
    system_prompt = (
        "You are a mentor who designs hands-on practice projects. Return ONLY JSON: "
        '{"repo_name": str (kebab-case, short), "description": str (2-3 sentences, Spanish), '
        '"checklist": [str, ...] (5-8 concrete steps, Spanish)}'
    )
    user_prompt = (
        f"Career: {career_path or 'software developer'}\nPhase: {phase_title}\n"
        f"Topics: {', '.join(topic_titles[:10])}\n\nDesign one practical project that "
        "exercises these topics."
    )
    raw = call_ai(
        provider,
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        max_tokens=1200,
    )
    data = _extract_json(raw)
    if not isinstance(data, dict) or not data.get("repo_name"):
        raise AIServiceError("La IA no devolvió un proyecto válido.")
    return data
