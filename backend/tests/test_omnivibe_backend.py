"""OmniVibe backend regression tests.

Covers (per review request):
- Auth (/api/auth/me, 401 on unauth)
- Cross-user ownership isolation (404 when accessing another user's project)
- AI generation endpoints (prd, screens, schemas, testing, build_prompt) - REAL LLM calls
- PRD edit -> version bump (PUT /api/projects/{id}/prd)
- Feature update -> progress recompute
- Checklist toggle
- Export (markdown + pdf) for all available docs + 404 friendly
- Generation history endpoint
"""

import os
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")

# Seeded sessions (see /app/memory/test_credentials.md)
USER1_TOKEN = "test_session_omnivibe_2026"
USER2_TOKEN = "test_session_omnivibe_2026_b"

AI_TIMEOUT = 180  # AI generations can take 30-120s


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def s1():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {USER1_TOKEN}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def s2():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {USER2_TOKEN}",
                      "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def project_id(s1):
    r = s1.get(f"{BASE_URL}/api/projects", timeout=30)
    assert r.status_code == 200, r.text
    projects = r.json()
    fittrack = next((p for p in projects if p.get("title") == "FitTrack"), None)
    assert fittrack is not None, "Seeded FitTrack project missing"
    return fittrack["project_id"]


# ---------- Auth ----------

class TestAuth:
    def test_auth_me_ok(self, s1):
        r = s1.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["user_id"] == "test-user-omnivibe"
        assert data["email"] == "test.user.omnivibe@example.com"

    def test_projects_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/projects", timeout=15)
        assert r.status_code == 401

    def test_invalid_token_401(self):
        r = requests.get(
            f"{BASE_URL}/api/projects",
            headers={"Authorization": "Bearer not_a_real_token"},
            timeout=15,
        )
        assert r.status_code == 401


# ---------- Cross-user isolation ----------

class TestOwnership:
    def test_user2_cannot_see_user1_project(self, s2, project_id):
        # user2 should get 404 on user1's project detail
        r = s2.get(f"{BASE_URL}/api/projects/{project_id}", timeout=15)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}: {r.text}"

    def test_user2_cannot_update_user1_project(self, s2, project_id):
        r = s2.put(f"{BASE_URL}/api/projects/{project_id}",
                   json={"title": "Hacked"}, timeout=15)
        assert r.status_code == 404

    def test_user2_project_list_isolated(self, s2):
        r = s2.get(f"{BASE_URL}/api/projects", timeout=15)
        assert r.status_code == 200
        for p in r.json():
            assert p["user_id"] == "test-user-omnivibe-2"


# ---------- Generation history endpoint (cheap, no LLM) ----------

class TestHistory:
    def test_history_returns_list(self, s1, project_id):
        r = s1.get(f"{BASE_URL}/api/projects/{project_id}/history", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Feature update + progress recompute ----------

class TestFeatures:
    def test_update_feature_recomputes_progress(self, s1, project_id):
        feats = s1.get(f"{BASE_URL}/api/projects/{project_id}/features", timeout=15).json()
        assert len(feats) >= 1
        # Pick a feature not already 'done' if possible
        target = next((f for f in feats if f.get("status") != "done"), feats[0])
        fid = target["feature_id"]
        original_status = target.get("status", "backlog")

        # set to done with valid priority enum (P0/P1/P2)
        r = s1.put(
            f"{BASE_URL}/api/projects/{project_id}/features/{fid}",
            json={"status": "done", "priority": "P0"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["status"] == "done"
        assert updated["priority"] == "P0"

        # progress recompute on project
        proj = s1.get(f"{BASE_URL}/api/projects/{project_id}", timeout=15).json()
        assert proj["progress"] >= 1

        # revert to keep state clean
        s1.put(
            f"{BASE_URL}/api/projects/{project_id}/features/{fid}",
            json={"status": original_status},
            timeout=15,
        )


# ---------- Export 404 friendly (run BEFORE generation populates docs) ----------

class TestExportEarly:
    """Test 404 for un-generated docs. Run these before LLM tests."""

    def test_export_unknown_doc_404(self, s1, project_id):
        r = s1.get(
            f"{BASE_URL}/api/projects/{project_id}/export",
            params={"doc": "nonsense", "format": "markdown"},
            timeout=15,
        )
        assert r.status_code == 404
        body = r.json()
        assert "detail" in body and len(body["detail"]) > 0


# ---------- AI Generation (REAL LLM) ----------
# Tests are ordered: prd first so PRD edit/version test can run after.

class TestGeneration:
    """LLM calls are slow (~60s each). Cloud ingress may return 502 after ~100s
    even though backend completes and persists data. So we verify EITHER a clean
    200 OR proxy 502 followed by data persisted via the corresponding GET endpoint.
    """

    @staticmethod
    def _assert_gen_or_persisted(r, get_fn, validate_fn):
        if r.status_code == 200:
            data = r.json()
            validate_fn(data)
            return data
        # Proxy/ingress timeout — verify backend persisted the result anyway
        assert r.status_code in (502, 504), \
            f"Unexpected status: {r.status_code} {r.text[:300]}"
        persisted = get_fn()
        assert persisted, "Generation failed AND nothing persisted in DB"
        validate_fn(persisted)
        return persisted

    @pytest.mark.order(1)
    def test_generate_prd(self, s1, project_id):
        r = s1.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/prd",
            json={"mode": "generate"},
            timeout=AI_TIMEOUT,
        )

        def get_fn():
            return s1.get(f"{BASE_URL}/api/projects/{project_id}/prd", timeout=15).json()

        def validate(d):
            assert "content_markdown" in d
            assert len(d["content_markdown"]) > 100

        self._assert_gen_or_persisted(r, get_fn, validate)

    @pytest.mark.order(2)
    def test_generate_screens(self, s1, project_id):
        r = s1.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/screens",
            json={"mode": "generate"},
            timeout=AI_TIMEOUT,
        )

        def get_fn():
            return s1.get(f"{BASE_URL}/api/projects/{project_id}/screens", timeout=15).json()

        def validate(d):
            assert isinstance(d, list) and len(d) >= 1
            assert "screen_name" in d[0] or "name" in d[0]

        self._assert_gen_or_persisted(r, get_fn, validate)

    @pytest.mark.order(3)
    def test_generate_schemas(self, s1, project_id):
        r = s1.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/schemas",
            json={"mode": "generate"},
            timeout=AI_TIMEOUT,
        )

        def get_fn():
            return s1.get(f"{BASE_URL}/api/projects/{project_id}/schemas", timeout=15).json()

        def validate(d):
            assert isinstance(d, list) and len(d) >= 1
            assert "collection_name" in d[0] or "name" in d[0]

        self._assert_gen_or_persisted(r, get_fn, validate)

    @pytest.mark.order(4)
    def test_generate_testing(self, s1, project_id):
        r = s1.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/testing",
            json={"mode": "generate"},
            timeout=AI_TIMEOUT,
        )

        def get_fn():
            return s1.get(
                f"{BASE_URL}/api/projects/{project_id}/checklists/testing", timeout=15
            ).json()

        def validate(d):
            # Generate response wraps in {checklist:..., type:"testing"}; GET returns checklist dict directly
            checklist = d.get("checklist", d)
            assert "items" in checklist and isinstance(checklist["items"], list)
            assert len(checklist["items"]) >= 1

        self._assert_gen_or_persisted(r, get_fn, validate)

    @pytest.mark.order(5)
    def test_generate_build_prompt(self, s1, project_id):
        r = s1.post(
            f"{BASE_URL}/api/projects/{project_id}/generate/build_prompt",
            json={"mode": "generate"},
            timeout=AI_TIMEOUT,
        )

        def get_fn():
            return s1.get(
                f"{BASE_URL}/api/projects/{project_id}/build-prompt", timeout=15
            ).json()

        def validate(d):
            assert d is not None, "build_prompt is null in DB"
            text = (
                d.get("content_markdown")
                or d.get("prompt")
                or d.get("content")
                or ""
            )
            assert isinstance(text, str) and len(text) > 50, \
                f"build_prompt body missing/short, keys={list(d.keys()) if isinstance(d, dict) else type(d)}"

        self._assert_gen_or_persisted(r, get_fn, validate)


# ---------- PRD editor save -> version bump ----------

class TestPRDEditor:
    def test_put_prd_bumps_version(self, s1, project_id):
        # Need prior PRD (generated above)
        prev = s1.get(f"{BASE_URL}/api/projects/{project_id}/prd", timeout=15).json()
        assert prev is not None, "PRD must be generated before this test"
        prev_version = prev["version"]
        new_md = prev["content_markdown"] + "\n\n## Manual Edit\nAdded by test."
        r = s1.put(
            f"{BASE_URL}/api/projects/{project_id}/prd",
            json={"content_markdown": new_md},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        saved = r.json()
        assert saved["version"] == prev_version + 1
        assert saved["content_markdown"] == new_md
        # GET returns latest
        latest = s1.get(f"{BASE_URL}/api/projects/{project_id}/prd", timeout=15).json()
        assert latest["version"] == saved["version"]


# ---------- Checklist toggle ----------

class TestChecklistToggle:
    def test_toggle_testing_item_persists(self, s1, project_id):
        cl = s1.get(f"{BASE_URL}/api/projects/{project_id}/checklists/testing", timeout=15).json()
        assert cl and cl.get("items"), "Testing checklist must exist (generated earlier)"
        item = cl["items"][0]
        item_id = item["item_id"]
        new_val = not bool(item.get("checked", False))
        r = s1.put(
            f"{BASE_URL}/api/projects/{project_id}/checklists/testing/items/{item_id}",
            json={"checked": new_val},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # Verify persistence
        after = s1.get(f"{BASE_URL}/api/projects/{project_id}/checklists/testing", timeout=15).json()
        matched = next(i for i in after["items"] if i["item_id"] == item_id)
        assert matched["checked"] == new_val

    def test_toggle_invalid_item_404(self, s1, project_id):
        r = s1.put(
            f"{BASE_URL}/api/projects/{project_id}/checklists/testing/items/bogus_id",
            json={"checked": True},
            timeout=15,
        )
        assert r.status_code == 404


# ---------- Export markdown + pdf ----------

class TestExportFull:
    @pytest.mark.parametrize("doc", ["prd", "features", "schemas", "testing"])
    def test_export_markdown(self, s1, project_id, doc):
        r = s1.get(
            f"{BASE_URL}/api/projects/{project_id}/export",
            params={"doc": doc, "format": "markdown"},
            timeout=30,
        )
        assert r.status_code == 200, f"{doc} md export failed: {r.status_code} {r.text[:300]}"
        assert "text/markdown" in r.headers.get("content-type", "")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".md" in cd
        assert len(r.text) > 50

    @pytest.mark.parametrize("doc", ["prd", "schemas"])
    def test_export_pdf(self, s1, project_id, doc):
        r = s1.get(
            f"{BASE_URL}/api/projects/{project_id}/export",
            params={"doc": doc, "format": "pdf"},
            timeout=60,
        )
        assert r.status_code == 200, f"{doc} pdf failed: {r.status_code} {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        # %PDF- magic header
        assert r.content[:5] == b"%PDF-", f"Not a PDF: {r.content[:20]}"
