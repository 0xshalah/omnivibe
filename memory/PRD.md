# OmniVibe — PRD & Build Memory

## Original Problem Statement
Build OmniVibe — **an AI full-stack code builder**. Users describe an app idea and OmniVibe generates a real React + Vite + Tailwind + FastAPI + MongoDB codebase. Users can inspect, edit, modify with AI chat, preview live, run build checks, and export/deploy the project.

**Important scope correction (2026-06-13)**: Earlier iterations treated OmniVibe as a planning/blueprint tool. The product is now positioned as a real AI code builder. Planning features (PRD, Roadmap, API Plan, DB Schema, Build Prompt) are kept as **supporting** tabs.

## User Choices
- AI model: **OpenAI GPT-5.5** via Emergent Universal LLM key (`emergentintegrations`)
- Auth: **Emergent-managed Google login** (httpOnly session cookie + Bearer)
- Code Editor: **Monaco Editor** (`@monaco-editor/react`)
- Live Preview: **Sandpack** (`@codesandbox/sandpack-react`) for frontend execution + Route Map + Screen Mockups
- Codebase Export: **ZIP + Markdown bundle** (both)
- Scope: Full code-builder feature set built in one iteration

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, shadcn/ui, lucide-react, framer-motion, Monaco, Sandpack, jszip, file-saver, sonner, react-router-dom
- **Backend** (`/app/backend/`):
  - `server.py` — FastAPI app, all `/api/...` routes
  - `auth.py` — Emergent OAuth session exchange
  - `models.py` — Pydantic schemas (extended with `FileUpsert`, `PatchRequest`, etc.)
  - `database.py` — Motor MongoDB connection
  - `ai_service.py` — Planning generators (PRD/Features/Screens/APIs/Schemas/Checklists/Build prompt)
  - `code_service.py` — **NEW**: Code generation engine, file CRUD, patch lifecycle, build checks, ZIP/MD export, chat memory
  - `export_service.py` — Markdown/PDF docs export
- **DB Collections**: users, user_sessions, projects, prd_documents, feature_modules, screen_plans, api_plans, database_schemas, checklists, build_prompts, generation_history, **project_files**, **patch_history**, **code_generations**, **chat_messages**, **build_checks**
- All routes prefixed `/api`; ownership validated on every project-scoped route

## What's Implemented (2026-06-13 — Full Code Builder Pivot)

### Core Code Builder
1. **Direct codebase generation** — GPT-5.5 plans the app (pages/components/api/schemas) then batches file content generation in parallel (4 concurrent batches, size 4); persisted incrementally so UI shows progress. Background task pattern with `code_generations` status polling.
2. **File system management** — `project_files` collection. CRUD endpoints: list, get content, upsert, delete, rename. File tree endpoint builds nested folder structure.
3. **Monaco code editor** — full syntax highlighting (js/ts/jsx/tsx/py/json/html/css/md/yaml), theme-aware, save/dirty state, multi-language detection.
4. **AI chat code editing** — `chat_messages` collection. Send instruction → background patch planning → patch persisted as `pending` → frontend polls and shows preview.
5. **Patch/diff workflow** — Line-level diff viewer. Preview shows files-to-create / files-to-update (with before/after diff) / files-to-delete. Apply, reject, or roll back. Rollback restores `before_snapshots`.
6. **Version history** — All patches in `patch_history`. Statuses: planning / pending / applied / rejected / rolled_back / failed. Each applied patch can be rolled back.
7. **Live preview** — Sandpack runs the generated React frontend in an iframe with Tailwind CDN. Route Map and Screen Mockups as fallback for non-runnable assets.
8. **Build readiness checker** — Static checks: required files present, dependencies, API prefix, CORS, env vars, README. Status: not_ready / needs_review / build_ready / deployment_ready.
9. **Codebase export** — ZIP (server-built via `zipfile`), Markdown bundle (single .md with every file fenced), quick-copy individual files.
10. **Deployment workflow** — UI guides user through verification → Emergent → ZIP/Markdown → env vars checklist.

### Supporting Planning (preserved)
- 10 planning tabs: Overview, PRD Editor, Roadmap (Kanban), Screens, API Plan, Database, Testing, Deployment, Docs Export, Build Prompt
- All previous AI generators still work via `/api/projects/{id}/generate/{type}`

### Auth, Theme, UX
- Emergent Google OAuth (7-day session cookies)
- Dark default + light toggle
- Responsive (mobile top-bar, AI panel hidden on small screens)
- Right-side AI panel: contextual actions per tab, project state card, jump-to nav, recent AI activity

## Key Implementation Notes
- Long LLM calls handled with **background tasks + polling** (codebase gen ~2min, patches ~30-90s) — avoids Cloudflare 60s proxy cutoff
- Parallel batched file generation: 4 batches concurrent, semaphore-bounded
- Safety stubs added for `backend/requirements.txt`, `backend/.env.example`, `frontend/.env.example` if AI skipped them
- `chat_messages` records both user instructions and AI replies (with `patch_id` metadata)
- Test identity in `/app/memory/test_credentials.md`

## API Endpoints
### Projects
- `GET /api/projects` — list (includes file_count, build_status)
- `POST /api/projects` — create (with extended fields: visual_style, integrations, etc.)
- `GET/PUT/DELETE /api/projects/{id}`

### Codebase
- `POST /api/projects/{id}/codebase/generate` — background generation
- `GET /api/projects/{id}/codebase` — generation status + live_file_count
- `GET /api/projects/{id}/files/tree` — nested tree
- `GET /api/projects/{id}/files` — flat list
- `GET /api/projects/{id}/files/content?path=...`
- `PUT /api/projects/{id}/files` — upsert
- `DELETE /api/projects/{id}/files?path=...`
- `POST /api/projects/{id}/files/rename`

### Patches
- `POST /api/projects/{id}/patch` — start background patch
- `GET /api/projects/{id}/patches`
- `GET /api/projects/{id}/patches/{pid}`
- `POST /api/projects/{id}/patches/{pid}/apply|reject|rollback`

### Build / Export
- `GET/POST /api/projects/{id}/build-check`
- `GET /api/projects/{id}/codebase/export/zip`
- `GET /api/projects/{id}/codebase/export/bundle`

### Chat
- `GET /api/projects/{id}/chat`

### Planning (preserved)
- `POST /api/projects/{id}/generate/{type}` (prd/features/screens/apis/schemas/testing/deployment/build_prompt)
- Plus all artifact GET endpoints

## Prioritized Backlog
### P0 (remaining)
- None — full feature scope shipped

### P1
- SSE streaming for code generation progress (replaces polling)
- Diff view: side-by-side toggle, full LCS-based line matching
- Auto-run build check after each patch apply (currently triggers but doesn't surface result immediately in chat)
- Better selection of "relevant files" using AST/import graph

### P2
- Multi-file edit in editor (tabs)
- Search across files
- Public share link
- Team collaboration / RBAC
- Multiple AI model support (config-driven)
- Resume/continue partial generations

## Next Tasks
- Gather user feedback on generated code quality and tune prompts
- P1 items above
