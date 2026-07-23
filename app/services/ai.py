"""
AI Service Module for Bitácora
Handles AI-powered resource suggestions, roadmap enhancement, and content generation.
"""
import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import AIProvider
from app.schemas import AIProvider as AIProviderSchema

logger = logging.getLogger(__name__)


def _get_provider_client(provider: AIProvider):
    """Get the appropriate AI client based on provider type."""
    if provider.provider_type == "openai":
        from openai import OpenAI
        return OpenAI(api_key=provider.api_key, base_url=provider.base_url)
    elif provider.provider_type == "anthropic":
        from anthropic import Anthropic
        return Anthropic(api_key=provider.api_key, base_url=provider.base_url)
    elif provider.provider_type == "ollama":
        from openai import OpenAI
        return OpenAI(api_key="ollama", base_url=provider.base_url or "http://localhost:11434/v1")
    else:
        # Default to OpenAI-compatible
        from openai import OpenAI
        return OpenAI(api_key=provider.api_key, base_url=provider.base_url)


def _call_ai(provider: AIProvider, messages: List[Dict[str, str]], model: Optional[str] = None, **kwargs) -> str:
    """Call the AI provider with the given messages."""
    client = _get_provider_client(provider)
    model_name = model or provider.default_model or "gpt-4o-mini"
    
    try:
        if provider.provider_type == "anthropic":
            # Anthropic uses a different API format
            response = client.messages.create(
                model=model_name,
                max_tokens=kwargs.get("max_tokens", 4000),
                messages=messages,
            )
            return response.content[0].text
        else:
            # OpenAI-compatible format
            response = client.chat.completions.create(
                model=model_name,
                messages=messages,
                max_tokens=kwargs.get("max_tokens", 4000),
                temperature=kwargs.get("temperature", 0.7),
            )
            return response.choices[0].message.content
    except Exception as e:
        logger.error(f"AI call failed: {e}")
        raise


def generate_resource_suggestions(
    provider: AIProvider,
    career_path: str,
    phase_titles: List[str],
    topic_titles: List[str],
    model: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Generate AI-powered resource suggestions for a career path and roadmap structure.
    
    Returns a list of resource objects with:
    - title: Resource title
    - url: Resource URL
    - category: Resource category (docs, video, lab, article, tool, other)
    - description: Brief description
    - phase: Related phase title
    - topic: Related topic title
    """
    
    system_prompt = """You are an expert career coach and technical curriculum designer. 
Your task is to suggest high-quality learning resources for a specific career path and roadmap structure.

For each resource, provide:
1. title - Clear, descriptive title
2. url - Direct link to the resource (official docs, tutorials, courses, videos, etc.)
3. category - One of: docs, video, lab, article, tool, other
4. description - 1-2 sentence description of what the resource covers
5. phase - The phase title this resource relates to
6. topic - The topic title this resource relates to

Focus on:
- Official documentation and tutorials
- High-quality free resources (YouTube channels, free courses, articles)
- Hands-on labs and interactive tutorials
- Industry-standard tools and platforms
- Resources that are current and actively maintained

Return ONLY a valid JSON array of resource objects. No markdown, no extra text."""

    # Build context about the roadmap structure
    roadmap_context = f"Career Path: {career_path}\n\n"
    roadmap_context += "Roadmap Structure:\n"
    for i, phase in enumerate(phase_titles):
        roadmap_context += f"  Phase {i+1}: {phase}\n"
        # Find topics for this phase
        phase_topics = [t for t in topic_titles if t.startswith(f"{phase}") or True]  # Simplified
        for topic in topic_titles[:5]:  # Limit to avoid token overflow
            roadmap_context += f"    - {topic}\n"

    user_prompt = f"""{roadmap_context}

Generate 15-20 high-quality learning resources tailored to this career path and roadmap structure.
Distribute resources across the phases and topics.
Prioritize official documentation, free high-quality tutorials, and hands-on labs.
Return ONLY a JSON array."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = _call_ai(provider, messages, model, max_tokens=4000, temperature=0.7)
        
        # Parse JSON response
        # Clean up potential markdown code blocks
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        resources = json.loads(response.strip())
        
        # Validate and normalize resources
        validated_resources = []
        for r in resources:
            if isinstance(r, dict) and "title" in r and "url" in r:
                validated_resources.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "category": r.get("category", "article"),
                    "description": r.get("description", ""),
                    "phase": r.get("phase", ""),
                    "topic": r.get("topic", ""),
                })
        
        return validated_resources
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response as JSON: {e}")
        logger.error(f"Response: {response[:500]}")
        return _get_fallback_resources(career_path, phase_titles, topic_titles)
    except Exception as e:
        logger.error(f"AI resource suggestion failed: {e}")
        return _get_fallback_resources(career_path, phase_titles, topic_titles)


def enhance_roadmap_with_ai(
    provider: AIProvider,
    roadmap_data: Dict[str, Any],
    career_path: str,
) -> Dict[str, Any]:
    """
    Enhance roadmap data with AI-generated content based on career path.
    Adds more specific topics, subtopics, and resources tailored to the career.
    """
    
    system_prompt = """You are an expert career coach and technical curriculum designer.
Your task is to enhance a roadmap with more specific, career-tailored content.

Given a roadmap structure and a career path, enhance it by:
1. Adding more specific subtopics to existing topics
2. Adding relevant resources (with URLs) to subtopics
3. Optionally adding new topics to phases if they're missing key areas for the career

Return the enhanced roadmap in the SAME JSON format as input.
Only add content - don't remove or restructure existing content.
Focus on practical, industry-relevant skills and current technologies.

Return ONLY valid JSON. No markdown, no extra text."""

    user_prompt = f"""Career Path: {career_path}

Current Roadmap:
{json.dumps(roadmap_data, indent=2)}

Enhance this roadmap for a {career_path} career. Add:
- More specific subtopics with practical focus
- High-quality resource URLs (official docs, tutorials, courses)
- Career-specific tools and technologies
- Current industry best practices

Return the enhanced roadmap in the same JSON format."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = _call_ai(provider, messages, max_tokens=6000, temperature=0.7)
        
        # Clean up response
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        enhanced = json.loads(response.strip())
        return enhanced
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI enhancement response: {e}")
        return roadmap_data
    except Exception as e:
        logger.error(f"AI roadmap enhancement failed: {e}")
        return roadmap_data


def generate_roadmap_from_scratch(
    provider: AIProvider,
    career_path: str,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generate a complete roadmap from scratch for a given career path.
    """
    
    system_prompt = """You are an expert career coach and technical curriculum designer.
Generate a comprehensive, structured roadmap for a specific career path.

The roadmap should have:
- 4-6 phases (Fundamentals, Core Skills, Advanced, Specialization, Career Growth)
- Each phase has 3-5 topics
- Each topic has 3-5 subtopics
- Each subtopic has 2-4 relevant resources with URLs

Format as JSON:
{
  "title": "Career Path Roadmap",
  "description": "Brief description",
  "phases": [
    {
      "title": "Phase Name",
      "description": "Phase description",
      "color": "#hexcolor",
      "topics": [
        {
          "title": "Topic Name",
          "description": "Topic description",
          "subtopics": [
            {
              "title": "Subtopic Name",
              "description": "Subtopic description",
              "resources": [
                {"label": "Resource Name", "url": "https://..."}
              ]
            }
          ]
        }
      ]
    }
  ]
}

Focus on:
- Current industry standards and technologies
- Practical, hands-on skills
- Official documentation and high-quality free resources
- Progressive learning path from beginner to advanced
- Career-specific tools and platforms

Return ONLY valid JSON. No markdown, no extra text."""

    user_prompt = f"""Generate a comprehensive roadmap for: {career_path}

Create a structured learning path from beginner to job-ready professional.
Include current technologies, tools, and best practices for 2024-2025.
Prioritize official documentation, free high-quality courses, and hands-on labs."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        response = _call_ai(provider, messages, model, max_tokens=8000, temperature=0.7)
        
        response = response.strip()
        if response.startswith("```json"):
            response = response[7:]
        if response.startswith("```"):
            response = response[3:]
        if response.endswith("```"):
            response = response[:-3]
        
        roadmap = json.loads(response.strip())
        return roadmap
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI roadmap generation: {e}")
        return _get_fallback_roadmap(career_path)
    except Exception as e:
        logger.error(f"AI roadmap generation failed: {e}")
        return _get_fallback_roadmap(career_path)


def _get_fallback_resources(career_path: str, phase_titles: List[str], topic_titles: List[str]) -> List[Dict[str, Any]]:
    """Fallback resources when AI fails."""
    return [
        {
            "title": f"Official {career_path} Documentation",
            "url": "https://docs.example.com",
            "category": "docs",
            "description": "Official documentation and guides",
            "phase": phase_titles[0] if phase_titles else "Fundamentals",
            "topic": topic_titles[0] if topic_titles else "Getting Started",
        },
        {
            "title": f"{career_path} Tutorial - FreeCodeCamp",
            "url": "https://freecodecamp.org",
            "category": "video",
            "description": "Free comprehensive video course",
            "phase": phase_titles[0] if phase_titles else "Fundamentals",
            "topic": topic_titles[0] if topic_titles else "Getting Started",
        },
        {
            "title": f"{career_path} Hands-on Labs",
            "url": "https://github.com",
            "category": "lab",
            "description": "Practice projects and exercises",
            "phase": phase_titles[1] if len(phase_titles) > 1 else "Core Skills",
            "topic": topic_titles[1] if len(topic_titles) > 1 else "Practice",
        },
    ]


def _get_fallback_roadmap(career_path: str) -> Dict[str, Any]:
    """Fallback roadmap when AI generation fails."""
    return {
        "title": f"{career_path} Roadmap",
        "description": f"Learning path for {career_path}",
        "phases": [
            {
                "title": "Fundamentals",
                "description": "Core concepts and basics",
                "color": "#3fb950",
                "topics": [
                    {
                        "title": "Getting Started",
                        "description": "Introduction and setup",
                        "subtopics": [
                            {"title": "Environment Setup", "description": "Install tools and configure environment", "resources": []},
                            {"title": "Hello World", "description": "First steps and basic syntax", "resources": []},
                        ]
                    }
                ]
            },
            {
                "title": "Core Skills",
                "description": "Essential skills for the career",
                "color": "#61dafb",
                "topics": [
                    {
                        "title": "Core Concepts",
                        "description": "Fundamental concepts",
                        "subtopics": [
                            {"title": "Concept 1", "description": "Description", "resources": []},
                            {"title": "Concept 2", "description": "Description", "resources": []},
                        ]
                    }
                ]
            }
        ]
    }