"""OmniVibe code generation, file system, patch and build-readiness service."""
import asyncio
import json
import logging
import os
import re
import zipfile
from io import BytesIO

from emergentintegrations.llm.chat import LlmChat, UserMessage

from database import db
from models import new_id, now_iso

logger = logging.getLogger(__name__)
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

# Files in this list are considered required for a "build-ready" project.
DEFAULT_REQUIRED_FILES = [
    "frontend/package.json",
    "frontend/index.html",
    "frontend/src/main.jsx",
    "frontend/src/App.jsx",
    "backend/server.py",
    "backend/requirements.txt",
    "backend/.env.example",
    "README.md",
]

PREVIEWABLE_EXTS = {".jsx", ".tsx", ".js", ".ts", ".css", ".html", ".json"}

CODE_SYSTEM_MESSAGE = (
    "You are OmniVibe, an elite AI full-stack developer. You generate REAL, RUN-READY production code "
    "for full-stack web applications. Default stack: React + Vite + Tailwind frontend, FastAPI + MongoDB backend. "
    "You write idiomatic, clean code. You never produce placeholder comments like '// add code here' or '...'. "
    "Every file you produce must be COMPLETE and immediately usable. When asked for JSON, return ONLY valid JSON "
    "with no markdown fences and no commentary."
)


class CodeGenError(Exception):
    pass


# ---------------------------------------------------------------- LLM helpers


async def _call_llm(prompt: str, session_id: str, timeout: int = 240) -> str:
    if not EMERGENT_LLM_KEY:
        raise CodeGenError("AI key is not configured")
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=CODE_SYSTEM_MESSAGE,
    ).with_model("openai", "gpt-5.5")
    try:
        response = await asyncio.wait_for(chat.send_message(UserMessage(text=prompt)), timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise CodeGenError("AI generation timed out") from exc
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM call failed: %s", exc)
        raise CodeGenError(f"AI generation failed: {exc}") from exc
    return str(response)


def _strip_fences(text: str) -> str:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:json|markdown|md|jsx|tsx|js|ts|python|py)?\s*", "", cleaned)
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
        raise CodeGenError("AI did not return valid JSON")
    start = min(starts)
    closer = "]" if cleaned[start] == "[" else "}"
    end = cleaned.rfind(closer)
    if end <= start:
        raise CodeGenError("AI did not return valid JSON")
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as exc:
        raise CodeGenError(f"AI returned malformed JSON: {exc}") from exc


def _detect_language(path: str) -> str:
    name = path.lower()
    if name.endswith((".jsx", ".tsx")):
        return "javascript"
    if name.endswith(".ts"):
        return "typescript"
    if name.endswith(".js"):
        return "javascript"
    if name.endswith(".py"):
        return "python"
    if name.endswith(".json"):
        return "json"
    if name.endswith(".html"):
        return "html"
    if name.endswith(".css"):
        return "css"
    if name.endswith(".md"):
        return "markdown"
    if name.endswith(".env") or name.endswith(".env.example") or name.endswith(".env.local"):
        return "ini"
    if name.endswith(".yml") or name.endswith(".yaml"):
        return "yaml"
    if name.endswith(".sh"):
        return "shell"
    return "plaintext"


async def _project_context(project: dict, extra: str | None = None) -> str:
    parts = [
        f"App title: {project.get('title')}",
        f"Project type: {project.get('project_type')}",
        f"App idea: {project.get('idea')}",
    ]
    if project.get("description"):
        parts.append(f"Short description: {project['description']}")
    if project.get("target_users"):
        parts.append(f"Target users: {project['target_users']}")
    if project.get("visual_style"):
        parts.append(f"Preferred visual style: {project['visual_style']}")
    if project.get("required_features"):
        parts.append(f"Required features: {project['required_features']}")
    if project.get("integrations"):
        parts.append(f"Required integrations: {project['integrations']}")
    if project.get("auth_required") is not None:
        parts.append(f"Authentication required: {project['auth_required']}")
    if project.get("database_required") is not None:
        parts.append(f"Database required: {project['database_required']}")
    if project.get("deployment_target"):
        parts.append(f"Deployment expectation: {project['deployment_target']}")
    if extra:
        parts.append(extra)
    return "\n".join(parts)


# ---------------------------------------------------------------- File CRUD


async def upsert_file(project_id: str, path: str, content: str, source: str = "ai") -> dict:
    """Create or update a single project file (in-place, no version row)."""
    path = path.strip().lstrip("/")
    name = path.split("/")[-1]
    language = _detect_language(path)
    file_type = path.split(".")[-1] if "." in name else "file"
    existing = await db.project_files.find_one({"project_id": project_id, "file_path": path}, {"_id": 0})
    now = now_iso()
    if existing:
        await db.project_files.update_one(
            {"project_id": project_id, "file_path": path},
            {"$set": {"content": content, "updated_at": now, "language": language, "file_type": file_type, "source": source}},
        )
        existing.update({"content": content, "updated_at": now, "language": language, "file_type": file_type, "source": source})
        return existing
    doc = {
        "file_id": new_id("file_"),
        "project_id": project_id,
        "file_path": path,
        "file_name": name,
        "file_type": file_type,
        "language": language,
        "content": content,
        "source": source,
        "created_at": now,
        "updated_at": now,
    }
    await db.project_files.insert_one({**doc})
    return doc


async def delete_file(project_id: str, path: str) -> bool:
    path = path.strip().lstrip("/")
    res = await db.project_files.delete_one({"project_id": project_id, "file_path": path})
    return res.deleted_count > 0


async def get_file(project_id: str, path: str) -> dict | None:
    return await db.project_files.find_one(
        {"project_id": project_id, "file_path": path.strip().lstrip("/")}, {"_id": 0}
    )


async def list_files(project_id: str, with_content: bool = False) -> list:
    projection = {"_id": 0} if with_content else {"_id": 0, "content": 0}
    return (
        await db.project_files.find({"project_id": project_id}, projection)
        .sort("file_path", 1)
        .to_list(2000)
    )


def build_tree(files: list) -> list:
    """Build a nested directory tree from a flat list of file records."""
    root = {}
    for f in files:
        parts = f["file_path"].split("/")
        cursor = root
        for i, part in enumerate(parts):
            is_leaf = i == len(parts) - 1
            if part not in cursor:
                cursor[part] = {"__name": part, "__is_dir": not is_leaf, "__children": {}, "__file": f if is_leaf else None}
            cursor = cursor[part]["__children"]

    def serialize(node_map, prefix=""):
        items = []
        for key, value in sorted(node_map.items(), key=lambda kv: (not kv[1]["__is_dir"], kv[0])):
            path = f"{prefix}/{key}" if prefix else key
            if value["__is_dir"]:
                items.append(
                    {"type": "folder", "name": key, "path": path, "children": serialize(value["__children"], path)}
                )
            else:
                f = value["__file"]
                items.append(
                    {
                        "type": "file",
                        "name": key,
                        "path": path,
                        "language": f.get("language"),
                        "updated_at": f.get("updated_at"),
                        "size": len(f.get("content", "")) if f.get("content") is not None else None,
                    }
                )
        return items

    return serialize(root)


# ---------------------------------------------------------------- Initial codebase generation


PROJECT_PLAN_PROMPT = """Plan a complete full-stack React + Vite + Tailwind + FastAPI + MongoDB application for this idea.

{context}

Return ONLY a single JSON object with exactly these keys:
- "summary": 2-4 sentence description of the actual app you will build
- "tech_stack": array of stack items, e.g. ["React 18 + Vite", "Tailwind CSS", "FastAPI", "MongoDB"]
- "pages": array of objects, each with keys: "name" (PascalCase), "route" (e.g. "/dashboard"), "purpose" (1 sentence)
- "components": array of objects, each with keys: "name" (PascalCase), "purpose"
- "api_routes": array of objects, each with keys: "method" (GET/POST/PUT/DELETE/PATCH), "route" (must start with /api), "purpose"
- "collections": array of objects, each with keys: "name" (snake_case), "fields" (array of strings like "field_name: type")
- "files": array of file objects you will generate. Each item MUST have keys "path" and "purpose". Include these files at minimum:
  - frontend/package.json
  - frontend/index.html
  - frontend/vite.config.js
  - frontend/tailwind.config.js
  - frontend/postcss.config.js
  - frontend/src/main.jsx
  - frontend/src/App.jsx
  - frontend/src/index.css
  - frontend/src/lib/api.js
  - frontend/src/pages/{{PageName}}.jsx for each page above
  - frontend/src/components/{{Component}}.jsx for the most important components
  - backend/server.py
  - backend/models.py
  - backend/database.py
  - backend/requirements.txt
  - backend/.env.example
  - README.md
- "readme": full README.md markdown content with setup instructions, env vars, run commands, deployment notes

Constraints:
- All frontend API calls must use import.meta.env.VITE_API_BASE_URL with /api prefix.
- Use Tailwind for styling. No CSS frameworks other than Tailwind.
- Use FastAPI with APIRouter prefix='/api'. Use Motor for MongoDB.
- No placeholder paths. Every path must be concrete.
- Be specific to THIS app — never produce a generic Todo app unless that is the requested idea.
"""


FILE_BATCH_PROMPT = """Generate the actual source code for the following files of the app.

App context:
{context}

App plan (use as truth for routes, models, pages and collections):
{plan_summary}

Files to generate (return code for EACH, in order):
{file_list}

Return ONLY a single JSON object with this shape:
{{
  "files": [
    {{ "path": "<exact path>", "content": "<full file content as a single string>" }},
    ...
  ]
}}

Rules:
- "content" must be the COMPLETE file content as a JSON-escaped string (use \\n for newlines).
- No placeholders, no "..." comments. Code must actually run.
- React files must use JSX with default exports. Use functional components.
- Tailwind utility classes only (no inline styles unless needed for dynamic values).
- For FastAPI: APIRouter(prefix='/api'), routes prefixed with /api, validate with Pydantic.
- For MongoDB: use Motor's AsyncIOMotorClient with env var MONGO_URL.
- frontend/package.json must include react, react-dom, react-router-dom, axios, tailwindcss, postcss, autoprefixer, vite, @vitejs/plugin-react.
- frontend/index.html must mount #root and load /src/main.jsx.
- frontend/src/main.jsx must render <App /> inside <BrowserRouter>.
- frontend/src/App.jsx must wire <Routes> for each page in the plan.
- frontend/src/lib/api.js must export an axios instance using import.meta.env.VITE_API_BASE_URL.
- backend/server.py must include CORS middleware allowing all origins for dev.
- backend/requirements.txt must list fastapi, uvicorn[standard], motor, pydantic, python-dotenv.
- backend/.env.example must list MONGO_URL, DB_NAME, and any other env keys needed for this app (placeholder values only).
- Do NOT include real secrets or API keys.
"""


def _looks_like_code_content(text: str) -> bool:
    return bool(text and len(text.strip()) > 0)


async def _generate_plan(project: dict) -> dict:
    context = await _project_context(project)
    prompt = PROJECT_PLAN_PROMPT.format(context=context)
    output = await _call_llm(prompt, f"{project['project_id']}-codegen-plan")
    plan = _extract_json(output)
    if not isinstance(plan, dict):
        raise CodeGenError("Plan response is not a JSON object")
    # Normalize
    plan["pages"] = plan.get("pages") or []
    plan["components"] = plan.get("components") or []
    plan["api_routes"] = plan.get("api_routes") or []
    plan["collections"] = plan.get("collections") or []
    plan["files"] = [f for f in (plan.get("files") or []) if isinstance(f, dict) and f.get("path")]
    plan["tech_stack"] = plan.get("tech_stack") or ["React + Vite", "Tailwind", "FastAPI", "MongoDB"]
    plan["summary"] = plan.get("summary") or project.get("idea", "")
    plan["readme"] = plan.get("readme") or ""
    if not plan["files"]:
        raise CodeGenError("Plan returned no files")
    return plan


async def _generate_file_batch(project: dict, plan: dict, file_paths: list, batch_idx: int) -> list:
    context = await _project_context(project)
    plan_summary = json.dumps(
        {
            "summary": plan.get("summary"),
            "pages": plan.get("pages"),
            "components": plan.get("components"),
            "api_routes": plan.get("api_routes"),
            "collections": plan.get("collections"),
        },
        indent=2,
    )[:6000]
    file_list = "\n".join(f"- {p['path']} : {p.get('purpose', '')}" for p in file_paths)
    prompt = FILE_BATCH_PROMPT.format(context=context, plan_summary=plan_summary, file_list=file_list)
    output = await _call_llm(prompt, f"{project['project_id']}-codegen-batch-{batch_idx}")
    data = _extract_json(output)
    if isinstance(data, list):
        files = data
    else:
        files = data.get("files") or []
    out = []
    for f in files:
        if not isinstance(f, dict) or not f.get("path"):
            continue
        path = str(f["path"]).strip().lstrip("/")
        content = f.get("content", "")
        if isinstance(content, (list, dict)):
            content = json.dumps(content, indent=2)
        else:
            content = str(content)
        if not _looks_like_code_content(content):
            continue
        out.append({"path": path, "content": content})
    return out


async def generate_codebase(project: dict) -> dict:
    """Generate the full initial codebase for a project. Saves all files to project_files."""
    project_id = project["project_id"]
    # 1) Plan
    plan = await _generate_plan(project)

    # 2) Batched file content generation (small batches to dodge proxy timeouts)
    file_specs = plan["files"]
    # Always ensure a README is added
    if not any(f["path"] == "README.md" for f in file_specs):
        file_specs.append({"path": "README.md", "purpose": "Project README"})

    # Inject README content directly if AI returned one (fast path)
    seeded_files = []
    if plan.get("readme"):
        seeded_files.append({"path": "README.md", "content": plan["readme"]})
        file_specs = [f for f in file_specs if f["path"] != "README.md"]

    batch_size = 4
    batches = [file_specs[i : i + batch_size] for i in range(0, len(file_specs), batch_size)]

    # Run batches in parallel with bounded concurrency.
    # Each batch is persisted as it completes for incremental UI updates.
    generated = []
    sem = asyncio.Semaphore(4)

    async def run_batch(idx, batch):
        async with sem:
            try:
                batch_files = await _generate_file_batch(project, plan, batch, idx)
            except CodeGenError as exc:
                logger.warning("Batch %d failed: %s", idx, exc)
                return []
            # Persist immediately so the UI sees progress
            for f in batch_files:
                await upsert_file(project_id, f["path"], f["content"], source="ai-initial")
            await db.code_generations.update_one(
                {"project_id": project_id, "status": "in_progress"},
                {"$inc": {"files_done": len(batch_files)}, "$set": {"updated_at": now_iso()}},
            )
            return batch_files

    # Initialize counters
    await db.code_generations.update_one(
        {"project_id": project_id, "status": "in_progress"},
        {"$set": {"files_total": len(file_specs), "files_done": 0, "updated_at": now_iso()}},
    )

    results = await asyncio.gather(*[run_batch(i, b) for i, b in enumerate(batches)])
    for r in results:
        generated.extend(r)

    # Safety net: ensure critical files exist (always; cheap stubs if AI skipped them).
    existing_docs = await db.project_files.find({"project_id": project_id}, {"_id": 0, "file_path": 1}).to_list(2000)
    existing_paths = {d["file_path"] for d in existing_docs}
    stubs = {
        "backend/requirements.txt": "fastapi==0.110.1\nuvicorn[standard]==0.25.0\nmotor==3.3.1\npydantic==2.13.4\npython-dotenv==1.2.2\n",
        "backend/.env.example": "MONGO_URL=mongodb://localhost:27017\nDB_NAME=app_db\nCORS_ORIGINS=*\n",
        "frontend/.env.example": "VITE_API_BASE_URL=http://localhost:8001\n",
    }
    for path, content in stubs.items():
        if path not in existing_paths:
            await upsert_file(project_id, path, content, source="ai-stub")
            generated.append({"path": path, "content": content})

    # Add seeded files (e.g. README from plan)
    for f in seeded_files:
        await upsert_file(project_id, f["path"], f["content"], source="ai-initial")
        generated.append(f)

    # 4) Save plan as code_generations record
    await db.code_generations.update_one(
        {"project_id": project_id, "status": "in_progress"},
        {
            "$set": {
                "status": "completed",
                "summary": plan.get("summary"),
                "plan": plan,
                "file_count": len(generated),
                "completed_at": now_iso(),
                "updated_at": now_iso(),
            }
        },
    )

    # 5) Update project record
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {
                "status": "building",
                "updated_at": now_iso(),
                "tech_stack": plan.get("tech_stack"),
                "summary": plan.get("summary"),
            }
        },
    )

    return {
        "summary": plan.get("summary"),
        "tech_stack": plan.get("tech_stack"),
        "pages": plan.get("pages", []),
        "components": plan.get("components", []),
        "api_routes": plan.get("api_routes", []),
        "collections": plan.get("collections", []),
        "file_count": len(generated),
    }


async def start_codebase_generation(project: dict) -> dict:
    """Kick off codebase generation as a background task and return a generation record."""
    project_id = project["project_id"]
    # Wipe any prior in-flight or previous generation record + files
    await db.code_generations.delete_many({"project_id": project_id})
    await db.project_files.delete_many({"project_id": project_id})

    record = {
        "generation_id": new_id("gen_"),
        "project_id": project_id,
        "type": "initial",
        "status": "in_progress",
        "files_total": 0,
        "files_done": 0,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.code_generations.insert_one({**record})

    async def _runner():
        try:
            await generate_codebase(project)
            try:
                await run_build_check(project_id, project)
            except CodeGenError:
                pass
        except Exception as exc:  # noqa: BLE001
            logger.exception("Codebase generation crashed: %s", exc)
            await db.code_generations.update_one(
                {"project_id": project_id, "status": "in_progress"},
                {"$set": {"status": "failed", "error": str(exc), "updated_at": now_iso()}},
            )

    asyncio.create_task(_runner())
    return record


async def latest_codebase_generation(project_id: str) -> dict | None:
    return await db.code_generations.find_one({"project_id": project_id}, {"_id": 0}, sort=[("created_at", -1)])


# ---------------------------------------------------------------- Patch workflow


PATCH_PROMPT = """You are modifying an existing full-stack codebase based on a user instruction.

App context:
{context}

User instruction:
"{instruction}"

Current project file tree (paths only):
{tree}

Most relevant existing file contents (use these as the source of truth for the current state):
{relevant_files}

Return ONLY a JSON object with this exact shape:
{{
  "summary": "<one sentence high-level summary of the change>",
  "explanation": "<2-4 sentence explanation of what changed and why>",
  "build_impact": "<one of: improves, neutral, breaks_until_fixed>",
  "files_to_create": [ {{ "path": "<path>", "content": "<full new file content>", "reason": "<short reason>" }} ],
  "files_to_update": [ {{ "path": "<existing path>", "content": "<FULL new content>", "reason": "<short reason>" }} ],
  "files_to_delete": [ {{ "path": "<existing path>", "reason": "<short reason>" }} ]
}}

Rules:
- "content" must be the COMPLETE new file content (not a diff). No placeholders, no "...".
- Only touch files that genuinely need to change. Do not rewrite unrelated files.
- If creating new pages, also update App.jsx routes and any navigation components.
- If adding API routes, keep /api prefix and validate with Pydantic.
- If adding a MongoDB collection, also add corresponding Pydantic model & route.
- Preserve existing imports, formatting and conventions when updating.
- Do NOT include any secrets, API keys or private tokens.
"""


def _select_relevant_files(files: list, instruction: str, max_files: int = 12, max_chars_per_file: int = 4000) -> list:
    """Heuristically pick the most relevant existing files for an instruction."""
    instruction_lc = instruction.lower()
    tokens = [t for t in re.split(r"[^a-z0-9]+", instruction_lc) if len(t) > 2]

    def score(f):
        path = f["file_path"].lower()
        s = 0
        for t in tokens:
            if t in path:
                s += 5
        # Always boost entry points
        for key in ("app.jsx", "main.jsx", "server.py", "models.py", "database.py", "package.json", "requirements.txt"):
            if path.endswith(key):
                s += 2
        # Page/component files (most edits are here)
        if "/pages/" in path or "/components/" in path:
            s += 1
        return s

    ranked = sorted(files, key=score, reverse=True)
    selected = ranked[:max_files]
    out = []
    for f in selected:
        content = f.get("content") or ""
        if len(content) > max_chars_per_file:
            content = content[:max_chars_per_file] + "\n/* ...truncated for AI context... */"
        out.append({"path": f["file_path"], "content": content})
    return out


async def generate_patch(project: dict, instruction: str, patch_id: str | None = None) -> dict:
    project_id = project["project_id"]
    files = await list_files(project_id, with_content=True)
    if not files:
        raise CodeGenError("Generate the initial codebase before requesting AI edits")

    context = await _project_context(project)
    tree_str = "\n".join(f"- {f['file_path']}" for f in sorted(files, key=lambda x: x["file_path"]))
    relevant = _select_relevant_files(files, instruction)
    relevant_str = "\n\n".join(
        f"### {rf['path']}\n```\n{rf['content']}\n```" for rf in relevant
    )[:30000]

    prompt = PATCH_PROMPT.format(
        context=context,
        instruction=instruction.strip(),
        tree=tree_str[:8000],
        relevant_files=relevant_str,
    )
    output = await _call_llm(prompt, f"{project_id}-patch-{patch_id or new_id('p_')}")
    data = _extract_json(output)
    if not isinstance(data, dict):
        raise CodeGenError("Patch response is not a JSON object")

    # Normalize
    summary = str(data.get("summary") or "AI patch")
    explanation = str(data.get("explanation") or "")
    build_impact = str(data.get("build_impact") or "neutral")
    files_to_create = data.get("files_to_create") or []
    files_to_update = data.get("files_to_update") or []
    files_to_delete = data.get("files_to_delete") or []

    # Sanitize entries
    def clean_entry(e, require_content=True):
        if not isinstance(e, dict) or not e.get("path"):
            return None
        path = str(e["path"]).strip().lstrip("/")
        content = e.get("content", "")
        if isinstance(content, (dict, list)):
            content = json.dumps(content, indent=2)
        content = str(content) if content is not None else ""
        if require_content and not content.strip():
            return None
        return {"path": path, "content": content, "reason": str(e.get("reason") or "")}

    files_to_create = [c for c in (clean_entry(e) for e in files_to_create) if c]
    files_to_update = [c for c in (clean_entry(e) for e in files_to_update) if c]
    files_to_delete = [
        {"path": str(e["path"]).strip().lstrip("/"), "reason": str(e.get("reason") or "")}
        for e in files_to_delete
        if isinstance(e, dict) and e.get("path")
    ]

    if not (files_to_create or files_to_update or files_to_delete):
        raise CodeGenError("AI did not propose any file changes")

    # Capture before snapshots for affected files for rollback
    affected_paths = (
        [f["path"] for f in files_to_update] + [f["path"] for f in files_to_delete]
    )
    before_snapshots = {}
    for p in affected_paths:
        existing = await get_file(project_id, p)
        if existing:
            before_snapshots[p] = existing.get("content", "")

    pid_use = patch_id or new_id("patch_")
    return {
        "patch_id": pid_use,
        "project_id": project_id,
        "instruction": instruction.strip(),
        "summary": summary,
        "explanation": explanation,
        "build_impact": build_impact,
        "files_to_create": files_to_create,
        "files_to_update": files_to_update,
        "files_to_delete": files_to_delete,
        "before_snapshots": before_snapshots,
    }


async def start_patch(project: dict, instruction: str) -> dict:
    """Create a pending patch record (status=planning) and run the LLM in background."""
    project_id = project["project_id"]
    patch_id = new_id("patch_")
    skeleton = {
        "patch_id": patch_id,
        "project_id": project_id,
        "instruction": instruction.strip(),
        "summary": "Planning…",
        "explanation": "",
        "build_impact": "neutral",
        "status": "planning",
        "files_to_create": [],
        "files_to_update": [],
        "files_to_delete": [],
        "before_snapshots": {},
        "after_snapshots": {},
        "error": None,
        "created_at": now_iso(),
        "applied_at": None,
    }
    await db.patch_history.insert_one({**skeleton})

    async def _runner():
        try:
            result = await generate_patch(project, instruction, patch_id=patch_id)
            await db.patch_history.update_one(
                {"patch_id": patch_id},
                {
                    "$set": {
                        "summary": result["summary"],
                        "explanation": result["explanation"],
                        "build_impact": result["build_impact"],
                        "files_to_create": result["files_to_create"],
                        "files_to_update": result["files_to_update"],
                        "files_to_delete": result["files_to_delete"],
                        "before_snapshots": result["before_snapshots"],
                        "status": "pending",
                    }
                },
            )
            await add_chat_message(
                project_id,
                "assistant",
                result["explanation"] or result["summary"],
                {"patch_id": patch_id, "summary": result["summary"]},
            )
        except CodeGenError as exc:
            await db.patch_history.update_one(
                {"patch_id": patch_id},
                {"$set": {"status": "failed", "error": str(exc), "summary": "Failed to plan changes"}},
            )
            await add_chat_message(project_id, "assistant", f"Failed to plan changes: {exc}", {"error": True})
        except Exception as exc:  # noqa: BLE001
            logger.exception("Patch planning crashed: %s", exc)
            await db.patch_history.update_one(
                {"patch_id": patch_id},
                {"$set": {"status": "failed", "error": str(exc), "summary": "Failed to plan changes"}},
            )

    asyncio.create_task(_runner())
    return skeleton


async def apply_patch(project_id: str, patch_id: str) -> dict:
    patch = await db.patch_history.find_one({"patch_id": patch_id, "project_id": project_id}, {"_id": 0})
    if not patch:
        raise CodeGenError("Patch not found")
    if patch["status"] != "pending":
        raise CodeGenError(f"Patch already {patch['status']}")

    after = {}
    for f in patch.get("files_to_create", []) + patch.get("files_to_update", []):
        await upsert_file(project_id, f["path"], f["content"], source="ai-patch")
        after[f["path"]] = f["content"]
    for f in patch.get("files_to_delete", []):
        await delete_file(project_id, f["path"])

    await db.patch_history.update_one(
        {"patch_id": patch_id},
        {"$set": {"status": "applied", "applied_at": now_iso(), "after_snapshots": after}},
    )
    await db.projects.update_one({"project_id": project_id}, {"$set": {"updated_at": now_iso()}})
    return await db.patch_history.find_one({"patch_id": patch_id}, {"_id": 0})


async def reject_patch(project_id: str, patch_id: str) -> dict:
    res = await db.patch_history.update_one(
        {"patch_id": patch_id, "project_id": project_id, "status": "pending"},
        {"$set": {"status": "rejected", "applied_at": now_iso()}},
    )
    if res.matched_count == 0:
        raise CodeGenError("Patch not found or already actioned")
    return await db.patch_history.find_one({"patch_id": patch_id}, {"_id": 0})


async def rollback_patch(project_id: str, patch_id: str) -> dict:
    patch = await db.patch_history.find_one({"patch_id": patch_id, "project_id": project_id}, {"_id": 0})
    if not patch:
        raise CodeGenError("Patch not found")
    if patch["status"] != "applied":
        raise CodeGenError("Only applied patches can be rolled back")

    # Reverse the change:
    # - files_to_create (that were created) should be deleted
    # - files_to_update should be restored from before_snapshots
    # - files_to_delete should be restored from before_snapshots
    for f in patch.get("files_to_create", []):
        await delete_file(project_id, f["path"])
    for path, before_content in patch.get("before_snapshots", {}).items():
        await upsert_file(project_id, path, before_content, source="rollback")

    await db.patch_history.update_one(
        {"patch_id": patch_id}, {"$set": {"status": "rolled_back", "applied_at": now_iso()}}
    )
    await db.projects.update_one({"project_id": project_id}, {"$set": {"updated_at": now_iso()}})
    return await db.patch_history.find_one({"patch_id": patch_id}, {"_id": 0})


async def list_patches(project_id: str) -> list:
    return (
        await db.patch_history.find(
            {"project_id": project_id},
            {
                "_id": 0,
                "before_snapshots": 0,
                "after_snapshots": 0,
            },
        )
        .sort("created_at", -1)
        .to_list(100)
    )


async def get_patch(project_id: str, patch_id: str) -> dict | None:
    return await db.patch_history.find_one({"patch_id": patch_id, "project_id": project_id}, {"_id": 0})


# ---------------------------------------------------------------- Build readiness


async def run_build_check(project_id: str, project: dict | None = None) -> dict:
    files = await list_files(project_id, with_content=True)
    by_path = {f["file_path"]: f for f in files}

    checks = []

    def add(name, status, hint=None):
        checks.append({"name": name, "status": status, "hint": hint})

    # Required entrypoints
    for required in DEFAULT_REQUIRED_FILES:
        if required in by_path:
            add(f"{required} present", "pass")
        else:
            add(f"{required} present", "fail", f"Missing {required}")

    # Package.json must have react & vite
    pkg = by_path.get("frontend/package.json")
    if pkg:
        c = pkg["content"]
        for needed in ("react", "vite", "tailwindcss", "axios"):
            add(f"frontend dependency: {needed}", "pass" if needed in c else "warn", None if needed in c else f"`{needed}` not found in package.json")
    # requirements.txt
    req = by_path.get("backend/requirements.txt")
    if req:
        c = req["content"]
        for needed in ("fastapi", "uvicorn", "motor", "pydantic"):
            add(f"backend dependency: {needed}", "pass" if needed in c else "warn", None if needed in c else f"`{needed}` not in requirements.txt")
    # API routes prefix
    server = by_path.get("backend/server.py")
    if server:
        c = server["content"]
        add("backend uses /api prefix", "pass" if "/api" in c else "warn", None if "/api" in c else "Backend routes should be prefixed with /api")
        add("backend has CORS", "pass" if "CORSMiddleware" in c else "warn", None if "CORSMiddleware" in c else "Add CORS middleware for cross-origin frontend calls")
    # frontend api lib
    api_lib = by_path.get("frontend/src/lib/api.js")
    if api_lib:
        c = api_lib["content"]
        add(
            "frontend uses VITE_API_BASE_URL",
            "pass" if "VITE_API_BASE_URL" in c else "warn",
            None if "VITE_API_BASE_URL" in c else "Frontend should read backend URL from VITE_API_BASE_URL env var",
        )
    # .env.example
    env_example = by_path.get("backend/.env.example")
    if env_example:
        c = env_example["content"]
        add(
            ".env.example lists MONGO_URL",
            "pass" if "MONGO_URL" in c else "warn",
            None if "MONGO_URL" in c else "Add MONGO_URL to .env.example",
        )
    # README
    readme = by_path.get("README.md")
    if readme:
        c = readme["content"]
        add("README has setup section", "pass" if "install" in c.lower() or "setup" in c.lower() else "warn", None if "install" in c.lower() or "setup" in c.lower() else "Add install/setup instructions")
    # auth requirement
    if project and project.get("auth_required"):
        has_auth = any("auth" in p.lower() or "login" in p.lower() for p in by_path)
        add("authentication implemented", "pass" if has_auth else "warn", None if has_auth else "User requested auth — add login/register routes & UI")
    # deployment config
    deploy_files = ["Dockerfile", "docker-compose.yml", "render.yaml", "vercel.json"]
    has_deploy = any(f in by_path for f in deploy_files)
    add(
        "deployment config present",
        "pass" if has_deploy else "warn",
        None if has_deploy else "Add a Dockerfile or platform config when ready to deploy",
    )

    # Aggregate
    fails = sum(1 for c in checks if c["status"] == "fail")
    warns = sum(1 for c in checks if c["status"] == "warn")
    if fails > 0:
        status = "not_ready"
    elif warns > 4:
        status = "needs_review"
    elif warns > 0:
        status = "build_ready"
    else:
        status = "deployment_ready"

    result = {
        "check_id": new_id("bld_"),
        "project_id": project_id,
        "status": status,
        "checks": checks,
        "file_count": len(files),
        "fail_count": fails,
        "warn_count": warns,
        "checked_at": now_iso(),
    }
    await db.build_checks.delete_many({"project_id": project_id})
    await db.build_checks.insert_one({**result})
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"build_status": status, "file_count": len(files), "updated_at": now_iso()}},
    )
    return result


async def latest_build_check(project_id: str) -> dict | None:
    return await db.build_checks.find_one({"project_id": project_id}, {"_id": 0})


# ---------------------------------------------------------------- Export


async def export_zip(project_id: str, title: str) -> bytes:
    files = await list_files(project_id, with_content=True)
    if not files:
        raise CodeGenError("No files to export")
    buf = BytesIO()
    safe_title = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "omnivibe-app"
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            zf.writestr(f"{safe_title}/{f['file_path']}", f.get("content") or "")
    return buf.getvalue()


async def export_markdown_bundle(project_id: str, title: str) -> str:
    files = await list_files(project_id, with_content=True)
    if not files:
        raise CodeGenError("No files to export")
    parts = [f"# {title} — Codebase Bundle", ""]
    for f in sorted(files, key=lambda x: x["file_path"]):
        lang = f.get("language", "")
        fence_lang = "" if lang in ("plaintext", "ini") else lang
        parts.append(f"## `{f['file_path']}`")
        parts.append(f"```{fence_lang}")
        parts.append(f.get("content") or "")
        parts.append("```")
        parts.append("")
    return "\n".join(parts)


# ---------------------------------------------------------------- Chat memory


async def add_chat_message(project_id: str, role: str, content: str, meta: dict | None = None) -> dict:
    doc = {
        "message_id": new_id("msg_"),
        "project_id": project_id,
        "role": role,
        "content": content,
        "meta": meta or {},
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one({**doc})
    return doc


async def list_chat_messages(project_id: str, limit: int = 200) -> list:
    return (
        await db.chat_messages.find({"project_id": project_id}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(limit)
    )
