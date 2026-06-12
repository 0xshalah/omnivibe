import re
from io import BytesIO

import markdown2
from xhtml2pdf import pisa

from database import db


class ExportError(Exception):
    pass


EXPORT_DOCS = {"prd", "features", "apis", "schemas", "testing", "deployment", "blueprint"}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "omnivibe"


async def _fetch(project_id: str):
    prd = await db.prd_documents.find_one({"project_id": project_id}, {"_id": 0}, sort=[("version", -1)])
    features = await db.feature_modules.find({"project_id": project_id}, {"_id": 0}).to_list(300)
    screens = await db.screen_plans.find({"project_id": project_id}, {"_id": 0}).to_list(300)
    apis = await db.api_plans.find({"project_id": project_id}, {"_id": 0}).to_list(300)
    schemas = await db.database_schemas.find({"project_id": project_id}, {"_id": 0}).to_list(300)
    testing = await db.checklists.find_one({"project_id": project_id, "checklist_type": "testing"}, {"_id": 0})
    deployment = await db.checklists.find_one({"project_id": project_id, "checklist_type": "deployment"}, {"_id": 0})
    build_prompt = await db.build_prompts.find_one({"project_id": project_id}, {"_id": 0})
    return prd, features, screens, apis, schemas, testing, deployment, build_prompt


def _features_md(title: str, features: list) -> str:
    lines = [f"# {title} — Feature Roadmap", ""]
    status_labels = {
        "backlog": "Backlog",
        "planned": "Planned",
        "in_progress": "In Progress",
        "needs_review": "Needs Review",
        "done": "Done",
    }
    for status, label in status_labels.items():
        group = [f for f in features if f.get("status") == status]
        if not group:
            continue
        lines.append(f"## {label}")
        for f in group:
            lines.append(f"### {f['title']}  `{f['priority']}`")
            if f.get("description"):
                lines.append(f["description"])
            if f.get("acceptance_criteria"):
                lines.append("\n**Acceptance criteria:**")
                lines.extend(f"- {c}" for c in f["acceptance_criteria"])
            if f.get("dependencies"):
                lines.append(f"\n**Depends on:** {', '.join(f['dependencies'])}")
            lines.append("")
    return "\n".join(lines)


def _screens_md(title: str, screens: list) -> str:
    lines = [f"# {title} — UI Screen Plan", ""]
    for s in screens:
        lines.append(f"## {s['screen_name']}")
        lines.append(f"**Purpose:** {s.get('purpose', '')}")
        if s.get("components"):
            lines.append("\n**Main components:**")
            lines.extend(f"- {c}" for c in s["components"])
        if s.get("user_actions"):
            lines.append("\n**User actions:**")
            lines.extend(f"- {a}" for a in s["user_actions"])
        lines.append(f"\n**Empty state:** {s.get('empty_state', '')}")
        lines.append(f"**Error state:** {s.get('error_state', '')}")
        lines.append(f"**Loading state:** {s.get('loading_state', '')}")
        lines.append(f"**Responsive notes:** {s.get('responsive_notes', '')}")
        lines.append("")
    return "\n".join(lines)


def _apis_md(title: str, apis: list) -> str:
    lines = [f"# {title} — API Plan", ""]
    for a in apis:
        auth = "Auth required" if a.get("auth_required") else "Public"
        lines.append(f"## `{a['method']} {a['route']}`")
        lines.append(f"{a.get('purpose', '')}  \n*{auth}*")
        lines.append(f"\n**Request body:**\n```\n{a.get('request_body', 'None')}\n```")
        lines.append(f"**Response shape:**\n```\n{a.get('response_shape', '')}\n```")
        if a.get("error_cases"):
            lines.append("**Error cases:**")
            lines.extend(f"- {e}" for e in a["error_cases"])
        lines.append("")
    return "\n".join(lines)


def _schemas_md(title: str, schemas: list) -> str:
    lines = [f"# {title} — MongoDB Schema Draft", ""]
    for s in schemas:
        lines.append(f"## `{s['collection_name']}`")
        if s.get("description"):
            lines.append(s["description"])
        lines.append("")
        lines.append("| Field | Type | Required | Description | Example |")
        lines.append("|---|---|---|---|---|")
        for f in s.get("fields", []):
            req = "Yes" if f.get("required") else "No"
            lines.append(
                f"| `{f['name']}` | `{f.get('type', '')}` | {req} | {f.get('description', '')} | {f.get('example', '')} |"
            )
        lines.append("")
    return "\n".join(lines)


def _checklist_md(title: str, checklist: dict, label: str) -> str:
    lines = [f"# {title} — {label}", ""]
    items = checklist.get("items", [])
    categories = []
    for item in items:
        if item["category"] not in categories:
            categories.append(item["category"])
    for cat in categories:
        lines.append(f"## {cat}")
        for item in items:
            if item["category"] == cat:
                mark = "x" if item.get("checked") else " "
                lines.append(f"- [{mark}] {item['text']}")
        lines.append("")
    return "\n".join(lines)


async def build_document(project: dict, doc_key: str):
    """Return (filename_base, markdown_text) for the requested export document."""
    if doc_key not in EXPORT_DOCS:
        raise ExportError(f"Unknown document type: {doc_key}")

    project_id = project["project_id"]
    title = project.get("title", "Project")
    slug = _slug(title)
    prd, features, screens, apis, schemas, testing, deployment, build_prompt = await _fetch(project_id)

    if doc_key == "prd":
        if not prd:
            raise ExportError("No PRD has been generated yet")
        return f"{slug}-prd", prd["content_markdown"]
    if doc_key == "features":
        if not features:
            raise ExportError("No feature roadmap has been generated yet")
        return f"{slug}-roadmap", _features_md(title, features)
    if doc_key == "apis":
        if not apis:
            raise ExportError("No API plan has been generated yet")
        return f"{slug}-api-plan", _apis_md(title, apis)
    if doc_key == "schemas":
        if not schemas:
            raise ExportError("No database schema has been generated yet")
        return f"{slug}-db-schema", _schemas_md(title, schemas)
    if doc_key == "testing":
        if not testing:
            raise ExportError("No testing checklist has been generated yet")
        return f"{slug}-testing-checklist", _checklist_md(title, testing, "Testing Checklist")
    if doc_key == "deployment":
        if not deployment:
            raise ExportError("No deployment checklist has been generated yet")
        return f"{slug}-deployment-checklist", _checklist_md(title, deployment, "Deployment Checklist")

    # blueprint: everything combined
    parts = [f"# {title} — Complete Project Blueprint", ""]
    parts.append(f"**Project type:** {project.get('project_type', '')}")
    if project.get("target_users"):
        parts.append(f"**Target users:** {project['target_users']}")
    if project.get("idea"):
        parts.append(f"\n**Original idea:** {project['idea']}")
    parts.append("\n---\n")
    if prd:
        parts.append(prd["content_markdown"])
        parts.append("\n---\n")
    if features:
        parts.append(_features_md(title, features))
        parts.append("\n---\n")
    if screens:
        parts.append(_screens_md(title, screens))
        parts.append("\n---\n")
    if apis:
        parts.append(_apis_md(title, apis))
        parts.append("\n---\n")
    if schemas:
        parts.append(_schemas_md(title, schemas))
        parts.append("\n---\n")
    if testing:
        parts.append(_checklist_md(title, testing, "Testing Checklist"))
        parts.append("\n---\n")
    if deployment:
        parts.append(_checklist_md(title, deployment, "Deployment Checklist"))
        parts.append("\n---\n")
    if build_prompt:
        parts.append(f"# {title} — Emergent-Ready Build Prompt\n")
        parts.append(build_prompt["content_markdown"])
    content = "\n".join(parts)
    if len(content.strip().splitlines()) <= 6:
        raise ExportError("Nothing has been generated yet for this project")
    return f"{slug}-blueprint", content


PDF_CSS = """
@page { size: A4; margin: 2cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #1a1a1a; line-height: 1.5; }
h1 { font-size: 20pt; margin-bottom: 8pt; color: #000; }
h2 { font-size: 14pt; margin-top: 16pt; margin-bottom: 6pt; color: #111; border-bottom: 1px solid #ddd; padding-bottom: 3pt; }
h3 { font-size: 12pt; margin-top: 12pt; margin-bottom: 4pt; }
code, pre { font-family: Courier, monospace; font-size: 9pt; background-color: #f4f4f4; }
pre { padding: 6pt; border: 1px solid #e0e0e0; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 9pt; }
th, td { border: 1px solid #ccc; padding: 4pt 6pt; text-align: left; }
th { background-color: #f0f0f0; }
li { margin-bottom: 2pt; }
"""


def markdown_to_pdf(md_text: str) -> bytes:
    html_body = markdown2.markdown(md_text, extras=["tables", "fenced-code-blocks", "task_list", "cuddled-lists"])
    html = f"<html><head><style>{PDF_CSS}</style></head><body>{html_body}</body></html>"
    buffer = BytesIO()
    result = pisa.CreatePDF(html, dest=buffer, encoding="utf-8")
    if result.err:
        raise ExportError("PDF generation failed")
    return buffer.getvalue()
