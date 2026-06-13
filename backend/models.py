import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


def new_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


PROJECT_STATUSES = ["draft", "planning", "building", "ready", "shipped"]
FEATURE_STATUSES = ["backlog", "planned", "in_progress", "needs_review", "done"]
FEATURE_PRIORITIES = ["P0", "P1", "P2"]


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    idea: str = Field(min_length=1, max_length=5000)
    description: Optional[str] = Field(default="", max_length=2000)
    target_users: Optional[str] = Field(default="", max_length=1000)
    project_type: Optional[str] = Field(default="Web App", max_length=100)
    visual_style: Optional[str] = Field(default="", max_length=500)
    required_features: Optional[str] = Field(default="", max_length=2000)
    integrations: Optional[str] = Field(default="", max_length=500)
    auth_required: Optional[bool] = Field(default=True)
    database_required: Optional[bool] = Field(default=True)
    deployment_target: Optional[str] = Field(default="Emergent", max_length=100)


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    idea: Optional[str] = Field(default=None, max_length=5000)
    description: Optional[str] = Field(default=None, max_length=2000)
    target_users: Optional[str] = Field(default=None, max_length=1000)
    project_type: Optional[str] = Field(default=None, max_length=100)
    visual_style: Optional[str] = Field(default=None, max_length=500)
    required_features: Optional[str] = Field(default=None, max_length=2000)
    integrations: Optional[str] = Field(default=None, max_length=500)
    auth_required: Optional[bool] = None
    database_required: Optional[bool] = None
    deployment_target: Optional[str] = Field(default=None, max_length=100)
    status: Optional[str] = None


class FileUpsert(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    content: str = Field(default="")


class FileRename(BaseModel):
    old_path: str = Field(min_length=1, max_length=500)
    new_path: str = Field(min_length=1, max_length=500)


class PatchRequest(BaseModel):
    instruction: str = Field(min_length=4, max_length=3000)


class ChatMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class PRDUpdate(BaseModel):
    content_markdown: str = Field(min_length=1)


class FeatureUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    checked: bool


class GenerateRequest(BaseModel):
    mode: Optional[str] = "generate"


class SessionExchangeRequest(BaseModel):
    session_id: str
