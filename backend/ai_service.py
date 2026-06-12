import json
import logging
import os
import re

from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import db
from models import FEATURE_PRIORITIES, FEATURE_STATUSES, new_id, now_iso

logger = logging.getLogger(__name__)

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

GEN_TYPES = {"prd", "features", "screens", "apis", "schemas", "testing", "deployment", "build_prompt"}

SYSTEM_MESSAGE = (
    "You are OmniVibe's AI planning engine, an expert product manager and software architect. "
    "You turn rough app ideas into concrete, specific, build-ready planning documents for full-stack web apps "
    "(React frontend, FastAPI backend, MongoDB database). "
    "Never produce vague or generic filler. Every output must be specific to the app described. "
    "When asked for JSON, return ONLY valid JSON with no markdown fences and no commentary."
)


class GenerationError(Exception):
    pass


async def _call_llm(prompt: str, session_id: str) -> str:
    if not EMERGENT_LLM_KEY:
        raise GenerationError("AI key is not configured")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_MESSAGE,
    ).with_model("openai", "gpt-5.5")
    try:
        response = await chat.send_message(UserMessage(text=prompt))
    except Exception as exc:  # noqa: BLE001 - surface any provider error as a retryable failure
        logger.error("LLM call failed: %s", exc)
        raise GenerationError(f"AI generation failed: {exc}") from exc
    return str(response)


def _strip_fences(text: str) -> str:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json|markdown|md)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    return cleaned.strip()


def _extract_json(text: str):
    cleaned = _strip_fences(text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    starts = [i for i in (cleaned.find("["), cleaned.find("{")) if i != -1]
    if not starts:
        raise GenerationError("AI did not return valid JSON")
    start = min(starts)
    closer = "]" if cleaned[start] == "[" else "}"
    end = cleaned.rfind(closer)
    if end <= start:
        raise GenerationError("AI did not return valid JSON")
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise GenerationError(f"AI returned malformed JSON: {exc}") from exc


def _as_str_list(value) -> list:
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    if value:
        return [str(value)]
    return []


def _as_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, indent=2)
    return str(value)


async def _project_context(project: dict, include_prd: bool = True) -> str:
    parts = [
        f"App title: {project.get('title')}",
        f"Project type: {project.get('project_type')}",
        f"App idea: {project.get('idea')}",
    ]
    if project.get("description"):
        parts.append(f"Short description: {project['description']}")
    if project.get("target_users"):
        parts.append(f"Target users: {project['target_users']}")
    if include_prd:
        prd = await db.prd_documents.find_one(
            {"project_id": project["project_id"]}, {"_id": 0}, sort=[("version", -1)]
        )
        if prd:
            parts.append(f"Current PRD (may be truncated):\n{prd['content_markdown'][:8000]}")
    return "\n\n".join(parts)


async def _record_history(project_id: str, generation_type: str, prompt: str, output: str):
    await db.generation_history.insert_one(
        {
            "history_id": new_id("gen_"),
            "project_id": project_id,
            "generation_type": generation_type,
            "prompt": prompt[:2000],
            "output": output[:8000],
            "created_at": now_iso(),
        }
    )


async def generate(project: dict, gen_type: str, mode: str = "generate") -> dict:
    if gen_type == "prd":
        return await _generate_prd(project, mode or "generate")
    if gen_type == "features":
        return await _generate_features(project)
    if gen_type == "screens":
        return await _generate_screens(project)
    if gen_type == "apis":
        return await _generate_apis(project)
    if gen_type == "schemas":
        return await _generate_schemas(project)
    if gen_type == "testing":
        return await _generate_checklist(project, "testing")
    if gen_type == "deployment":
        return await _generate_checklist(project, "deployment")
    if gen_type == "build_prompt":
        return await _generate_build_prompt(project)
    raise GenerationError(f"Unknown generation type: {gen_type}")


# ---------------------------------------------------------------- PRD


async def _generate_prd(project: dict, mode: str) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project, include_prd=(mode != "generate"))

    instructions = {
        "generate": "Create a complete Product Requirements Document for this app.",
        "improve": "Improve the current PRD: fill gaps, sharpen vague requirements, add missing acceptance criteria and edge cases, and tighten wording. Keep the same overall structure.",
        "technical": "Rewrite the current PRD to be significantly more technical: add concrete data types, endpoint specifications, MongoDB index suggestions, validation rules, and architectural decisions.",
        "simpler": "Rewrite the current PRD in simpler, plain language that a non-technical founder can fully understand. Keep all sections but remove jargon.",
    }
    instruction = instructions.get(mode, instructions["generate"])

    prompt = f"""{instruction}

Project context:
{context}

The PRD must be a Markdown document with exactly these top-level sections (## headings):
Executive Summary, Problem Statement, Target Users, Goals, Non-Goals, Core Features, Functional Requirements, Non-Functional Requirements, User Stories, Acceptance Criteria, Data Model Draft, API Plan, UI Screen Plan, Testing Checklist, Deployment Checklist.

Rules:
- Start with a single H1 title line: # {project.get('title')} — PRD
- Be concrete and specific to this app. No generic filler.
- User stories must use "As a ..., I want ..., so that ..." format.
- Data Model Draft must list MongoDB collections with key fields and types.
- API Plan must list FastAPI endpoints with HTTP method and route (all routes prefixed with /api).
- Testing Checklist and Deployment Checklist must be markdown task lists (- [ ] item).
- Return ONLY the Markdown document. No preamble, no closing remarks."""

    output = await _call_llm(prompt, f"{project_id}-prd")
    content = _strip_fences(output)

    latest = await db.prd_documents.find_one({"project_id": project_id}, {"_id": 0}, sort=[("version", -1)])
    version = (latest["version"] + 1) if latest else 1
    doc = {
        "prd_id": new_id("prd_"),
        "project_id": project_id,
        "content_markdown": content,
        "version": version,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.prd_documents.insert_one({**doc})
    await _record_history(project_id, f"prd:{mode}", prompt, content)
    return {"type": "prd", "prd": doc}


# ---------------------------------------------------------------- Features


async def _generate_features(project: dict) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project)
    prompt = f"""Generate the feature modules (build roadmap) for this app.

Project context:
{context}

Generate 8 to 14 feature modules covering the full MVP scope of this specific app.

Return ONLY a JSON array. Each item must have exactly these keys:
- "title": short module name (e.g. "Authentication", "Dashboard")
- "description": 1-2 sentence concrete description of what this module does in THIS app
- "priority": one of "P0", "P1", "P2" (P0 = must-have core)
- "status": always "backlog"
- "acceptance_criteria": array of 3-5 specific, testable criteria strings
- "dependencies": array of titles of other modules this depends on (empty array if none)"""

    output = await _call_llm(prompt, f"{project_id}-features")
    parsed = _extract_json(output)
    if not isinstance(parsed, list):
        raise GenerationError("AI did not return a list of feature modules")

    docs = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("title"):
            continue
        priority = str(item.get("priority", "P1")).upper()
        docs.append(
            {
                "feature_id": new_id("feat_"),
                "project_id": project_id,
                "title": str(item["title"]),
                "description": _as_text(item.get("description", "")),
                "priority": priority if priority in FEATURE_PRIORITIES else "P1",
                "status": "backlog",
                "acceptance_criteria": _as_str_list(item.get("acceptance_criteria")),
                "dependencies": _as_str_list(item.get("dependencies")),
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
        )
    if not docs:
        raise GenerationError("AI returned no usable feature modules")

    await db.feature_modules.delete_many({"project_id": project_id})
    await db.feature_modules.insert_many([{**d} for d in docs])
    await _record_history(project_id, "features", prompt, output)
    return {"type": "features", "features": docs}


# ---------------------------------------------------------------- Screens


async def _generate_screens(project: dict) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project)
    prompt = f"""Generate the UI screen plan for this app.

Project context:
{context}

Generate 6 to 12 screens covering the full user journey of this specific app.

Return ONLY a JSON array. Each item must have exactly these keys:
- "screen_name": e.g. "Dashboard"
- "purpose": 1-2 sentences on what this screen is for
- "components": array of the main UI components on the screen (be specific, e.g. "Stats cards row", "Project table with sort")
- "user_actions": array of actions users can perform on this screen
- "empty_state": what the screen shows when there is no data yet
- "error_state": what the screen shows when loading/saving fails
- "loading_state": what the screen shows while data loads
- "responsive_notes": how the layout adapts on tablet/mobile"""

    output = await _call_llm(prompt, f"{project_id}-screens")
    parsed = _extract_json(output)
    if not isinstance(parsed, list):
        raise GenerationError("AI did not return a list of screens")

    docs = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("screen_name"):
            continue
        docs.append(
            {
                "screen_id": new_id("scr_"),
                "project_id": project_id,
                "screen_name": str(item["screen_name"]),
                "purpose": _as_text(item.get("purpose", "")),
                "components": _as_str_list(item.get("components")),
                "user_actions": _as_str_list(item.get("user_actions")),
                "empty_state": _as_text(item.get("empty_state", "")),
                "error_state": _as_text(item.get("error_state", "")),
                "loading_state": _as_text(item.get("loading_state", "")),
                "responsive_notes": _as_text(item.get("responsive_notes", "")),
                "created_at": now_iso(),
            }
        )
    if not docs:
        raise GenerationError("AI returned no usable screens")

    await db.screen_plans.delete_many({"project_id": project_id})
    await db.screen_plans.insert_many([{**d} for d in docs])
    await _record_history(project_id, "screens", prompt, output)
    return {"type": "screens", "screens": docs}


# ---------------------------------------------------------------- API plan


async def _generate_apis(project: dict) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project)
    prompt = f"""Generate the FastAPI endpoint plan for this app's backend.

Project context:
{context}

Generate 10 to 20 endpoints covering the full MVP scope. All routes MUST be prefixed with /api.

Return ONLY a JSON array. Each item must have exactly these keys:
- "method": one of "GET", "POST", "PUT", "PATCH", "DELETE"
- "route": e.g. "/api/projects/{{id}}"
- "purpose": 1 sentence on what this endpoint does
- "request_body": compact JSON-like string of the request body, or "None" for GET/DELETE
- "response_shape": compact JSON-like string of the response
- "error_cases": array of error case strings, e.g. "401 if not authenticated"
- "auth_required": true or false"""

    output = await _call_llm(prompt, f"{project_id}-apis")
    parsed = _extract_json(output)
    if not isinstance(parsed, list):
        raise GenerationError("AI did not return a list of endpoints")

    docs = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("route"):
            continue
        docs.append(
            {
                "api_id": new_id("api_"),
                "project_id": project_id,
                "method": str(item.get("method", "GET")).upper(),
                "route": str(item["route"]),
                "purpose": _as_text(item.get("purpose", "")),
                "request_body": _as_text(item.get("request_body", "None")),
                "response_shape": _as_text(item.get("response_shape", "")),
                "error_cases": _as_str_list(item.get("error_cases")),
                "auth_required": bool(item.get("auth_required", True)),
                "created_at": now_iso(),
            }
        )
    if not docs:
        raise GenerationError("AI returned no usable endpoints")

    await db.api_plans.delete_many({"project_id": project_id})
    await db.api_plans.insert_many([{**d} for d in docs])
    await _record_history(project_id, "apis", prompt, output)
    return {"type": "apis", "apis": docs}


# ---------------------------------------------------------------- DB schemas


async def _generate_schemas(project: dict) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project)
    prompt = f"""Generate the MongoDB collection schema drafts for this app.

Project context:
{context}

Generate 4 to 10 collections covering the data model of this specific app.

Return ONLY a JSON array. Each item must have exactly these keys:
- "collection_name": snake_case name, e.g. "users"
- "description": 1 sentence on what this collection stores
- "fields": array of objects, each with exactly these keys:
  - "name": field name in snake_case
  - "type": MongoDB/JSON type, e.g. "string", "number", "boolean", "datetime (ISO string)", "array<string>", "object"
  - "required": true or false
  - "description": short field description
  - "example": short example value as a string"""

    output = await _call_llm(prompt, f"{project_id}-schemas")
    parsed = _extract_json(output)
    if not isinstance(parsed, list):
        raise GenerationError("AI did not return a list of collections")

    docs = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("collection_name"):
            continue
        fields = []
        for field in item.get("fields", []) or []:
            if not isinstance(field, dict) or not field.get("name"):
                continue
            fields.append(
                {
                    "name": str(field["name"]),
                    "type": _as_text(field.get("type", "string")),
                    "required": bool(field.get("required", False)),
                    "description": _as_text(field.get("description", "")),
                    "example": _as_text(field.get("example", "")),
                }
            )
        docs.append(
            {
                "schema_id": new_id("sch_"),
                "project_id": project_id,
                "collection_name": str(item["collection_name"]),
                "description": _as_text(item.get("description", "")),
                "fields": fields,
                "created_at": now_iso(),
            }
        )
    if not docs:
        raise GenerationError("AI returned no usable collections")

    await db.database_schemas.delete_many({"project_id": project_id})
    await db.database_schemas.insert_many([{**d} for d in docs])
    await _record_history(project_id, "schemas", prompt, output)
    return {"type": "schemas", "schemas": docs}


# ---------------------------------------------------------------- Checklists


CHECKLIST_SPECS = {
    "testing": {
        "label": "testing checklist",
        "count": "18 to 30",
        "categories": "Authentication, Forms, API Routes, Database, UI Responsiveness, Loading States, Error States, Permissions, Deployment Readiness",
    },
    "deployment": {
        "label": "deployment readiness checklist",
        "count": "12 to 20",
        "categories": "Environment Variables, Database, Authentication, API Routes, Frontend Build, Error Handling, Empty States, Mobile Responsiveness, Security, Production URL",
    },
}


async def _generate_checklist(project: dict, checklist_type: str) -> dict:
    project_id = project["project_id"]
    spec = CHECKLIST_SPECS[checklist_type]
    context = await _project_context(project)
    prompt = f"""Generate a practical, app-specific {spec['label']} for this app.

Project context:
{context}

Generate {spec['count']} checklist items. Each item must be a concrete, verifiable check written for THIS app (mention its actual screens, flows, and data).

Use only these categories: {spec['categories']}.

Return ONLY a JSON array. Each item must have exactly these keys:
- "category": one of the categories above
- "text": the checklist item text"""

    output = await _call_llm(prompt, f"{project_id}-{checklist_type}")
    parsed = _extract_json(output)
    if not isinstance(parsed, list):
        raise GenerationError("AI did not return a checklist")

    items = []
    for item in parsed:
        if not isinstance(item, dict) or not item.get("text"):
            continue
        items.append(
            {
                "item_id": new_id("itm_"),
                "category": _as_text(item.get("category", "General")),
                "text": _as_text(item["text"]),
                "checked": False,
            }
        )
    if not items:
        raise GenerationError("AI returned no usable checklist items")

    doc = {
        "checklist_id": new_id("chk_"),
        "project_id": project_id,
        "checklist_type": checklist_type,
        "items": items,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.checklists.delete_many({"project_id": project_id, "checklist_type": checklist_type})
    await db.checklists.insert_one({**doc})
    await _record_history(project_id, checklist_type, prompt, output)
    return {"type": checklist_type, "checklist": doc}


# ---------------------------------------------------------------- Build prompt


async def _generate_build_prompt(project: dict) -> dict:
    project_id = project["project_id"]
    context = await _project_context(project)

    features = await db.feature_modules.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    screens = await db.screen_plans.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    apis = await db.api_plans.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    schemas = await db.database_schemas.find({"project_id": project_id}, {"_id": 0}).to_list(200)
    testing = await db.checklists.find_one({"project_id": project_id, "checklist_type": "testing"}, {"_id": 0})

    artifact_parts = []
    if features:
        artifact_parts.append(
            "Planned feature modules:\n" + "\n".join(f"- [{f['priority']}] {f['title']}: {f['description']}" for f in features)
        )
    if screens:
        artifact_parts.append("Planned screens:\n" + "\n".join(f"- {s['screen_name']}: {s['purpose']}" for s in screens))
    if apis:
        artifact_parts.append("Planned API endpoints:\n" + "\n".join(f"- {a['method']} {a['route']}" for a in apis))
    if schemas:
        artifact_parts.append(
            "Planned MongoDB collections:\n"
            + "\n".join(f"- {s['collection_name']}: {', '.join(fl['name'] for fl in s['fields'][:12])}" for s in schemas)
        )
    if testing:
        artifact_parts.append(
            "Testing checklist highlights:\n" + "\n".join(f"- {i['text']}" for i in testing["items"][:12])
        )
    artifacts = "\n\n".join(artifact_parts) if artifact_parts else "No detailed artifacts generated yet — derive everything from the project context."

    prompt = f"""Create the final, polished build prompt that the user will paste into Emergent.sh (an AI full-stack app builder) to build this app end to end.

Project context:
{context}

{artifacts}

The output must be a single Markdown prompt addressed to the builder agent, with these sections (## headings):
App Name, Product Summary, Target Users, Core Features, Pages / Screens, Database Collections, API Routes, Authentication, UI Style & Design Direction, Integrations, Testing Checklist, Deployment Expectations.

Rules:
- Write it as direct instructions ("Build...", "Include...", "Use...").
- Be concrete: real screen names, real collection names, real routes. No placeholders like TBD.
- Recommend React + Tailwind frontend, FastAPI backend, MongoDB persistence.
- Do NOT include any API keys, secrets, or private tokens.
- Return ONLY the markdown prompt. No preamble, no closing remarks."""

    output = await _call_llm(prompt, f"{project_id}-build-prompt")
    content = _strip_fences(output)
    doc = {
        "prompt_id": new_id("bp_"),
        "project_id": project_id,
        "content_markdown": content,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.build_prompts.delete_many({"project_id": project_id})
    await db.build_prompts.insert_one({**doc})
    await _record_history(project_id, "build_prompt", prompt, content)
    return {"type": "build_prompt", "build_prompt": doc}
