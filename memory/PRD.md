# OmniVibe — PRD & Build Memory

## Original Problem Statement
Build the MVP of **OmniVibe**: an AI-powered project planning and build orchestration dashboard for vibe-coded applications (per uploaded PRD.md). Users turn rough app ideas into structured PRDs, feature roadmaps, UI screen plans, API plans, MongoDB schema drafts, testing checklists, deployment checklists, and final Emergent-ready build prompts. SaaS-style planning dashboard only — strictly NO Rust orchestrator, Docker sandboxing, 9Router, WSL2/local execution, filesystem patching, Ollama, or autonomous deployment.

## User Choices
- AI model: **OpenAI GPT-5.5** via Emergent Universal LLM key
- Auth: **Emergent-managed Google login**
- Theme: **Dark default + light toggle**
- Export: **Both Markdown + PDF**

## Architecture
- **Frontend**: React (CRA + craco), Tailwind, shadcn/ui, lucide-react, framer-motion, react-markdown, sonner
- **Backend**: FastAPI (`/app/backend/server.py`), split modules: `auth.py` (Emergent OAuth session exchange + cookie auth), `ai_service.py` (GPT-5.5 generators via emergentintegrations), `export_service.py` (markdown assembly + xhtml2pdf), `models.py`, `database.py`
- **DB**: MongoDB (Motor), UUID string ids, `{"_id": 0}` projections everywhere
- Collections: users, user_sessions, projects, prd_documents (versioned), feature_modules, screen_plans, api_plans, database_schemas, checklists, build_prompts, generation_history
- All API routes prefixed `/api`; ownership validated on every project-scoped route

## User Personas
- Solo founders / indie hackers planning apps before vibe-coding them
- Non-technical users who need structure before building on Emergent
- PMs/students/freelancers producing build-ready documentation

## What's Implemented (2026-06-12, MVP complete — all tests passing 23/23 backend + full UI smoke)
1. Landing page (dark premium, hero, features, how-it-works)
2. Emergent Google OAuth (session_id exchange → httpOnly cookie, 7-day sessions, /auth/me, logout)
3. Project CRUD + dashboard (cards w/ status, progress, updated date; create dialog; delete w/ confirm)
4. Workspace with 10 tabs: Overview (bento stats), PRD Editor (markdown edit/preview, versioned saves), Roadmap (5-column Kanban, HTML5 drag-drop, status/priority editing, detail dialog), Screens, API Plan, Database, Testing & Deployment checklists (toggleable items), Export Center, Build Prompt
5. AI generators (GPT-5.5): PRD (generate/improve/technical/simpler), features, screens, apis, schemas, testing, deployment, build_prompt + "Generate full blueprint" orchestration (PRD first, rest parallel) with per-step progress in AI panel
6. Right-side AI assistant panel: contextual actions per tab, blueprint progress, generation history
7. Export: Markdown + PDF for prd/features/apis/schemas/testing/deployment/blueprint
8. Theme toggle (dark default), responsive (sidebar→mobile topbar, AI panel hidden <lg)
9. Proxy-timeout recovery: if edge proxy 502s a long AI call, frontend polls GET endpoint to reconcile (backend persists results)

## Key Implementation Notes
- Emergent LLM key in `/app/backend/.env` (EMERGENT_LLM_KEY); model `gpt-5.5` via `LlmChat.with_model("openai", "gpt-5.5")`, non-streaming `send_message` (outputs parsed as JSON and persisted)
- Edge proxy kills requests >~100s; single generations run 30-90s each (build_prompt borderline). Frontend recovery handles it.
- Test identity: see `/app/memory/test_credentials.md`; auth testing playbook at `/app/auth_testing.md`
- Backend test suite: `/app/backend/tests/test_omnivibe_backend.py` (~4.5 min, real LLM calls)

## Prioritized Backlog
### P0 (remaining)
- (none — MVP scope complete)
### P1
- Move long AI generations to background tasks + polling endpoint (removes proxy-timeout edge case entirely)
- SSE streaming for PRD generation (progressive display)
- PRD version history viewer / restore previous versions
### P2
- Settings page (profile, default project type)
- Regenerate single feature module / screen instead of full replace
- Project search/filter on dashboard; pagination beyond 200 projects
- Mobile AI-panel access (drawer)
- Integration requirements planner section (from original PRD §6, deferred)

## Next Tasks
- Gather user feedback on generated content quality and adjust prompts
- P1 items above
