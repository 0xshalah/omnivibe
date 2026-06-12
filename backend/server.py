import logging
import os

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware

import ai_service
import export_service
from auth import get_current_user, router as auth_router
from database import client, db
from models import (
    FEATURE_PRIORITIES,
    FEATURE_STATUSES,
    PROJECT_STATUSES,
    ChecklistItemUpdate,
    FeatureUpdate,
    GenerateRequest,
    PRDUpdate,
    ProjectCreate,
    ProjectUpdate,
    new_id,
    now_iso,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="OmniVibe API")
api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)


# ---------------------------------------------------------------- helpers


async def get_owned_project(project_id: str, user: dict) -> dict:
    project = await db.projects.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def compute_progress(project_id: str) -> int:
    total = await db.feature_modules.count_documents({"project_id": project_id})
    if total == 0:
        return 0
    done = await db.feature_modules.count_documents({"project_id": project_id, "status": "done"})
    return round(done / total * 100)


async def touch_project(project_id: str):
    await db.projects.update_one({"project_id": project_id}, {"$set": {"updated_at": now_iso()}})


# ---------------------------------------------------------------- projects


@api_router.get("/projects")
async def list_projects(user: dict = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    for p in projects:
        p["progress"] = await compute_progress(p["project_id"])
        p["feature_count"] = await db.feature_modules.count_documents({"project_id": p["project_id"]})
    return projects


@api_router.post("/projects")
async def create_project(payload: ProjectCreate, user: dict = Depends(get_current_user)):
    doc = {
        "project_id": new_id("proj_"),
        "user_id": user["user_id"],
        "title": payload.title.strip(),
        "idea": payload.idea.strip(),
        "description": (payload.description or "").strip(),
        "target_users": (payload.target_users or "").strip(),
        "project_type": payload.project_type or "Web App",
        "status": "draft",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.projects.insert_one({**doc})
    doc["progress"] = 0
    doc["feature_count"] = 0
    return doc


@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    project = await get_owned_project(project_id, user)
    project["progress"] = await compute_progress(project_id)
    return project


@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectUpdate, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "status" in updates and updates["status"] not in PROJECT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of {PROJECT_STATUSES}")
    updates["updated_at"] = now_iso()
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    project["progress"] = await compute_progress(project_id)
    return project


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    await db.projects.delete_one({"project_id": project_id})
    for collection in (
        db.prd_documents,
        db.feature_modules,
        db.screen_plans,
        db.api_plans,
        db.database_schemas,
        db.checklists,
        db.build_prompts,
        db.generation_history,
    ):
        await collection.delete_many({"project_id": project_id})
    return {"ok": True}


# ---------------------------------------------------------------- artifacts


@api_router.get("/projects/{project_id}/prd")
async def get_prd(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.prd_documents.find_one({"project_id": project_id}, {"_id": 0}, sort=[("version", -1)])


@api_router.put("/projects/{project_id}/prd")
async def save_prd(project_id: str, payload: PRDUpdate, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    latest = await db.prd_documents.find_one({"project_id": project_id}, {"_id": 0}, sort=[("version", -1)])
    if latest and latest["content_markdown"] == payload.content_markdown:
        return latest
    doc = {
        "prd_id": new_id("prd_"),
        "project_id": project_id,
        "content_markdown": payload.content_markdown,
        "version": (latest["version"] + 1) if latest else 1,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.prd_documents.insert_one({**doc})
    await touch_project(project_id)
    return doc


@api_router.get("/projects/{project_id}/features")
async def get_features(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.feature_modules.find({"project_id": project_id}, {"_id": 0}).to_list(300)


@api_router.put("/projects/{project_id}/features/{feature_id}")
async def update_feature(
    project_id: str, feature_id: str, payload: FeatureUpdate, user: dict = Depends(get_current_user)
):
    await get_owned_project(project_id, user)
    updates = {}
    if payload.status is not None:
        if payload.status not in FEATURE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Status must be one of {FEATURE_STATUSES}")
        updates["status"] = payload.status
    if payload.priority is not None:
        if payload.priority not in FEATURE_PRIORITIES:
            raise HTTPException(status_code=400, detail=f"Priority must be one of {FEATURE_PRIORITIES}")
        updates["priority"] = payload.priority
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    updates["updated_at"] = now_iso()
    result = await db.feature_modules.update_one(
        {"feature_id": feature_id, "project_id": project_id}, {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Feature not found")
    await touch_project(project_id)
    return await db.feature_modules.find_one({"feature_id": feature_id}, {"_id": 0})


@api_router.get("/projects/{project_id}/screens")
async def get_screens(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.screen_plans.find({"project_id": project_id}, {"_id": 0}).to_list(300)


@api_router.get("/projects/{project_id}/api-plans")
async def get_api_plans(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.api_plans.find({"project_id": project_id}, {"_id": 0}).to_list(300)


@api_router.get("/projects/{project_id}/schemas")
async def get_schemas(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.database_schemas.find({"project_id": project_id}, {"_id": 0}).to_list(300)


@api_router.get("/projects/{project_id}/checklists/{checklist_type}")
async def get_checklist(project_id: str, checklist_type: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    if checklist_type not in ("testing", "deployment"):
        raise HTTPException(status_code=400, detail="Checklist type must be 'testing' or 'deployment'")
    return await db.checklists.find_one({"project_id": project_id, "checklist_type": checklist_type}, {"_id": 0})


@api_router.put("/projects/{project_id}/checklists/{checklist_type}/items/{item_id}")
async def toggle_checklist_item(
    project_id: str,
    checklist_type: str,
    item_id: str,
    payload: ChecklistItemUpdate,
    user: dict = Depends(get_current_user),
):
    await get_owned_project(project_id, user)
    if checklist_type not in ("testing", "deployment"):
        raise HTTPException(status_code=400, detail="Checklist type must be 'testing' or 'deployment'")
    result = await db.checklists.update_one(
        {"project_id": project_id, "checklist_type": checklist_type, "items.item_id": item_id},
        {"$set": {"items.$.checked": payload.checked, "updated_at": now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return await db.checklists.find_one({"project_id": project_id, "checklist_type": checklist_type}, {"_id": 0})


@api_router.get("/projects/{project_id}/build-prompt")
async def get_build_prompt(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return await db.build_prompts.find_one({"project_id": project_id}, {"_id": 0})


@api_router.get("/projects/{project_id}/history")
async def get_history(project_id: str, user: dict = Depends(get_current_user)):
    await get_owned_project(project_id, user)
    return (
        await db.generation_history.find({"project_id": project_id}, {"_id": 0, "prompt": 0, "output": 0})
        .sort("created_at", -1)
        .to_list(30)
    )


# ---------------------------------------------------------------- generation


@api_router.post("/projects/{project_id}/generate/{gen_type}")
async def generate(
    project_id: str, gen_type: str, payload: GenerateRequest, user: dict = Depends(get_current_user)
):
    project = await get_owned_project(project_id, user)
    if gen_type not in ai_service.GEN_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown generation type: {gen_type}")
    try:
        result = await ai_service.generate(project, gen_type, payload.mode or "generate")
    except ai_service.GenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    updates = {"updated_at": now_iso()}
    if project.get("status") == "draft":
        updates["status"] = "planning"
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    return result


# ---------------------------------------------------------------- export


@api_router.get("/projects/{project_id}/export")
async def export_document(
    project_id: str, doc: str, format: str = "markdown", user: dict = Depends(get_current_user)
):
    project = await get_owned_project(project_id, user)
    try:
        filename, md_text = await export_service.build_document(project, doc)
    except export_service.ExportError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    if format == "pdf":
        try:
            pdf_bytes = export_service.markdown_to_pdf(md_text)
        except export_service.ExportError as exc:
            raise HTTPException(status_code=500, detail=str(exc))
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
        )
    return Response(
        content=md_text,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
    )


@api_router.get("/")
async def root():
    return {"message": "OmniVibe API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
