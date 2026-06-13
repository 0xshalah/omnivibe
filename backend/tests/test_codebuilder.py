"""OmniVibe Code-Builder backend tests.

Focus: New code-builder endpoints introduced by the pivot.
Reuses an existing test project ("NoteApp") with pre-generated files
to avoid running a brand new 90-180s LLM codebase generation each run.
A separate test creates a fresh small project to validate the create flow
with new fields (visual_style/required_features/...) and verifies start_codebase_generation
returns immediately with in_progress.
"""

import io
import os
import time
import uuid
import zipfile

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
TOKEN = "test_session_omnivibe_2026"
HDR = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

GEN_POLL_INTERVAL = 15
GEN_POLL_MAX = 240  # 4 minutes
PATCH_POLL_INTERVAL = 8
PATCH_POLL_MAX = 180


# ---------------------- Fixtures ----------------------


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update(HDR)
    return sess


@pytest.fixture(scope="session")
def code_project_id(s):
    """Return id of an existing project with generated files (file_count >= 10)."""
    r = s.get(f"{BASE_URL}/api/projects", timeout=20)
    assert r.status_code == 200, r.text
    projs = r.json()
    chosen = next((p for p in projs if (p.get("file_count") or 0) >= 10), None)
    if not chosen:
        pytest.skip("No project with >=10 generated files; need NoteApp seed")
    return chosen["project_id"]


# ---------------------- 1. Auth ----------------------


class TestAuthBearer:
    def test_bearer_returns_user(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["user_id"] == "test-user-omnivibe"
        assert d["email"] == "test.user.omnivibe@example.com"


# ---------------------- 2. Project CRUD w/ new fields ----------------------


class TestProjectCreate:
    """POST /api/projects accepts new code-builder fields."""

    def test_create_with_new_fields(self, s):
        suffix = uuid.uuid4().hex[:6]
        payload = {
            "title": f"TEST_CodeBuilder_{suffix}",
            "idea": "A tiny todo list app",
            "target_users": "students",
            "project_type": "Web App",
            "visual_style": "minimal dark mode",
            "required_features": "todo crud, filters",
            "integrations": "none",
            "auth_required": False,
            "database_required": True,
            "deployment_target": "Emergent",
        }
        r = s.post(f"{BASE_URL}/api/projects", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["visual_style"] == "minimal dark mode"
        assert d["required_features"] == "todo crud, filters"
        assert d["auth_required"] is False
        assert d["database_required"] is True
        assert d["deployment_target"] == "Emergent"
        assert d["file_count"] == 0
        assert d["build_status"] == "not_ready"
        # cleanup
        s.delete(f"{BASE_URL}/api/projects/{d['project_id']}", timeout=15)

    def test_list_includes_file_count_and_build_status(self, s):
        r = s.get(f"{BASE_URL}/api/projects", timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert "file_count" in p
            assert "build_status" in p


# ---------------------- 3. Codebase generation ----------------------


class TestCodebaseGeneration:
    """Validate background generation returns immediately and progresses."""

    @pytest.fixture(scope="class")
    def small_proj(self, s):
        payload = {
            "title": f"TEST_GenSmoke_{uuid.uuid4().hex[:6]}",
            "idea": "small notes app",
            "project_type": "Web App",
            "auth_required": False,
            "database_required": True,
        }
        r = s.post(f"{BASE_URL}/api/projects", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        pid = r.json()["project_id"]
        yield pid
        s.delete(f"{BASE_URL}/api/projects/{pid}", timeout=15)

    def test_generation_returns_immediately(self, s, small_proj):
        t0 = time.time()
        r = s.post(
            f"{BASE_URL}/api/projects/{small_proj}/codebase/generate", timeout=30
        )
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "in_progress"
        assert "generation_id" in d
        # Should return promptly (background task)
        assert elapsed < 20, f"Generation POST took {elapsed:.1f}s (should be background)"

    def test_generation_progresses_and_completes(self, s, small_proj):
        # Poll status up to GEN_POLL_MAX
        status = None
        elapsed = 0
        while elapsed < GEN_POLL_MAX:
            r = s.get(f"{BASE_URL}/api/projects/{small_proj}/codebase", timeout=20)
            assert r.status_code == 200
            rec = r.json()
            status = (rec or {}).get("status")
            if status in ("completed", "failed"):
                break
            time.sleep(GEN_POLL_INTERVAL)
            elapsed += GEN_POLL_INTERVAL

        if status == "failed":
            pytest.fail(f"Codebase generation failed: {rec}")
        assert status == "completed", f"Did not complete in {GEN_POLL_MAX}s, status={status}"

        # Files should be >= 10 with required keys
        files = s.get(f"{BASE_URL}/api/projects/{small_proj}/files", timeout=20).json()
        assert len(files) >= 10, f"Only {len(files)} files generated"

        paths = {f["file_path"] for f in files}
        for req in (
            "frontend/package.json",
            "frontend/src/App.jsx",
            "backend/server.py",
            "README.md",
            "backend/requirements.txt",
            "backend/.env.example",
        ):
            assert req in paths, f"Missing required file: {req}; got {sorted(paths)[:10]}"

        # Content for one file
        c = s.get(
            f"{BASE_URL}/api/projects/{small_proj}/files/content",
            params={"path": "frontend/package.json"},
            timeout=15,
        ).json()
        assert c["content"] and len(c["content"]) > 5


# ---------------------- 4. File CRUD (uses pre-generated project) ----------------------


class TestFileCRUD:
    def test_tree_structure(self, s, code_project_id):
        r = s.get(f"{BASE_URL}/api/projects/{code_project_id}/files/tree", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d.get("tree"), list)
        assert d.get("count", 0) >= 1
        top = d["tree"][0]
        assert top.get("type") in ("folder", "file")
        assert "name" in top and "path" in top

    def test_files_list_returns_paths(self, s, code_project_id):
        r = s.get(f"{BASE_URL}/api/projects/{code_project_id}/files", timeout=15)
        assert r.status_code == 200
        files = r.json()
        assert len(files) >= 10
        assert all(f.get("file_path") for f in files)

    def test_get_file_content(self, s, code_project_id):
        r = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": "README.md"},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        assert "content" in d and len(d["content"]) > 0
        assert d["file_path"] == "README.md"

    def test_upsert_rename_delete_file(self, s, code_project_id):
        path = f"TEST_test/{uuid.uuid4().hex[:8]}.txt"
        # Upsert
        r = s.put(
            f"{BASE_URL}/api/projects/{code_project_id}/files",
            json={"path": path, "content": "hello world v1"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["file_path"] == path

        # Read
        rc = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": path},
            timeout=15,
        )
        assert rc.status_code == 200
        assert rc.json()["content"] == "hello world v1"

        # Update via upsert
        r2 = s.put(
            f"{BASE_URL}/api/projects/{code_project_id}/files",
            json={"path": path, "content": "hello world v2"},
            timeout=15,
        )
        assert r2.status_code == 200
        rc2 = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": path},
            timeout=15,
        ).json()
        assert rc2["content"] == "hello world v2"

        # Rename
        new_path = path.replace(".txt", "_renamed.txt")
        rn = s.post(
            f"{BASE_URL}/api/projects/{code_project_id}/files/rename",
            json={"old_path": path, "new_path": new_path},
            timeout=15,
        )
        assert rn.status_code == 200, rn.text

        # Old gone
        rc_old = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": path},
            timeout=15,
        )
        assert rc_old.status_code == 404

        # New exists
        rc_new = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": new_path},
            timeout=15,
        )
        assert rc_new.status_code == 200

        # Delete
        dl = s.delete(
            f"{BASE_URL}/api/projects/{code_project_id}/files",
            params={"path": new_path},
            timeout=15,
        )
        assert dl.status_code == 200

        rc_gone = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/files/content",
            params={"path": new_path},
            timeout=15,
        )
        assert rc_gone.status_code == 404


# ---------------------- 5. Build check ----------------------


class TestBuildCheck:
    def test_run_build_check(self, s, code_project_id):
        r = s.post(
            f"{BASE_URL}/api/projects/{code_project_id}/build-check", timeout=30
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") in (
            "not_ready",
            "needs_review",
            "build_ready",
            "deployment_ready",
        )
        assert isinstance(d.get("checks"), list) and len(d["checks"]) > 0
        # counts present
        assert "fail_count" in d
        assert "warn_count" in d

    def test_get_latest_build_check(self, s, code_project_id):
        r = s.get(f"{BASE_URL}/api/projects/{code_project_id}/build-check", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d and d.get("status")


# ---------------------- 6. Codebase export ----------------------


class TestExport:
    def test_export_zip(self, s, code_project_id):
        r = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/codebase/export/zip", timeout=60
        )
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/zip")
        z = zipfile.ZipFile(io.BytesIO(r.content))
        names = z.namelist()
        assert len(names) >= 5, names
        # contains a README
        assert any(n.endswith("README.md") for n in names), names

    def test_export_bundle_markdown(self, s, code_project_id):
        r = s.get(
            f"{BASE_URL}/api/projects/{code_project_id}/codebase/export/bundle",
            timeout=60,
        )
        assert r.status_code == 200
        assert "text/markdown" in r.headers.get("content-type", "")
        body = r.text
        # markdown code fences for files
        assert "```" in body
        assert len(body) > 500


# ---------------------- 7. Chat ----------------------


class TestChat:
    def test_chat_returns_list(self, s, code_project_id):
        r = s.get(f"{BASE_URL}/api/projects/{code_project_id}/chat", timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list)
        for m in msgs:
            assert m.get("role") in ("user", "assistant", "system")


# ---------------------- 8. AI Patch flow (REAL LLM, background) ----------------------


class TestPatch:
    """Submit patch; poll until pending; apply; verify; rollback."""

    @pytest.fixture(scope="class")
    def patch_id(self, s, code_project_id):
        r = s.post(
            f"{BASE_URL}/api/projects/{code_project_id}/patch",
            json={"instruction": "Add a /about route placeholder file frontend/src/pages/About.jsx exporting a tiny component."},
            timeout=30,
        )
        if r.status_code in (502, 504):
            pytest.skip(f"LLM proxy timeout on patch create: {r.status_code}")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "patch_id" in d
        assert d.get("status") in ("planning", "pending")
        return d["patch_id"], code_project_id

    def test_patch_progresses_to_pending(self, s, patch_id):
        pid, project_id = patch_id
        elapsed = 0
        status = None
        rec = None
        while elapsed < PATCH_POLL_MAX:
            r = s.get(
                f"{BASE_URL}/api/projects/{project_id}/patches/{pid}", timeout=20
            )
            assert r.status_code == 200, r.text
            rec = r.json()
            status = rec.get("status")
            if status in ("pending", "failed", "applied", "rejected"):
                break
            time.sleep(PATCH_POLL_INTERVAL)
            elapsed += PATCH_POLL_INTERVAL

        if status == "failed":
            pytest.skip(f"Patch planning failed (LLM): {rec.get('error')}")
        assert status == "pending", f"Patch did not transition to pending: {status}"
        # Should have at least one of create/update/delete
        total_changes = (
            len(rec.get("files_to_create") or [])
            + len(rec.get("files_to_update") or [])
            + len(rec.get("files_to_delete") or [])
        )
        assert total_changes >= 1, f"Patch produced no changes: {rec}"

    def test_apply_then_rollback(self, s, patch_id):
        pid, project_id = patch_id
        # Get current patch state
        rec = s.get(
            f"{BASE_URL}/api/projects/{project_id}/patches/{pid}", timeout=20
        ).json()
        if rec.get("status") != "pending":
            pytest.skip(f"Patch not pending (status={rec.get('status')})")

        new_paths = [f["path"] for f in (rec.get("files_to_create") or [])]
        updated_paths = [f["path"] for f in (rec.get("files_to_update") or [])]

        # Apply
        ap = s.post(
            f"{BASE_URL}/api/projects/{project_id}/patches/{pid}/apply", timeout=60
        )
        assert ap.status_code == 200, ap.text
        applied = ap.json()
        assert applied.get("status") == "applied"

        # Verify a created file exists
        if new_paths:
            r = s.get(
                f"{BASE_URL}/api/projects/{project_id}/files/content",
                params={"path": new_paths[0]},
                timeout=15,
            )
            assert r.status_code == 200, f"Created file missing: {new_paths[0]}"

        # Rollback
        rb = s.post(
            f"{BASE_URL}/api/projects/{project_id}/patches/{pid}/rollback", timeout=60
        )
        assert rb.status_code == 200, rb.text
        rb_rec = rb.json()
        assert rb_rec.get("status") == "rolled_back"

        # Verify created file removed
        if new_paths:
            r = s.get(
                f"{BASE_URL}/api/projects/{project_id}/files/content",
                params={"path": new_paths[0]},
                timeout=15,
            )
            assert r.status_code == 404, f"Created file still present after rollback: {new_paths[0]}"
