import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Code2,
  Database,
  Download,
  Eye,
  FileText,
  FlaskConical,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Monitor,
  Network,
  Package,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { GEN_LABELS, STATUS_LABELS } from "@/lib/labels";
import { BUILD_STATUS_LABELS, BUILD_STATUS_STYLES } from "@/lib/codeLabels";
import AppSidebar from "@/components/AppSidebar";
import AIPanel from "@/components/AIPanel";
import CodeTab from "@/components/workspace/CodeTab";
import PreviewTab from "@/components/workspace/PreviewTab";
import ChatTab from "@/components/workspace/ChatTab";
import BuildStatusTab from "@/components/workspace/BuildStatusTab";
import DeploymentTab from "@/components/workspace/DeploymentTab";
import CodebaseExportTab from "@/components/workspace/CodebaseExportTab";
import OverviewTab from "@/components/workspace/OverviewTab";
import PRDTab from "@/components/workspace/PRDTab";
import RoadmapTab from "@/components/workspace/RoadmapTab";
import ScreensTab from "@/components/workspace/ScreensTab";
import ApiTab from "@/components/workspace/ApiTab";
import SchemaTab from "@/components/workspace/SchemaTab";
import ChecklistTab from "@/components/workspace/ChecklistTab";
import ExportTab from "@/components/workspace/ExportTab";
import BuildPromptTab from "@/components/workspace/BuildPromptTab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveAs } from "file-saver";

// Code-builder tabs first; planning tabs supporting
const TABS = [
  { key: "code", label: "Code", icon: Code2, group: "build" },
  { key: "preview", label: "Live Preview", icon: Monitor, group: "build" },
  { key: "chat", label: "AI Chat", icon: MessageSquare, group: "build" },
  { key: "build", label: "Build", icon: ShieldCheck, group: "build" },
  { key: "deploy", label: "Deploy", icon: Rocket, group: "build" },
  { key: "export-code", label: "Export", icon: Package, group: "build" },
  { key: "overview", label: "Overview", icon: LayoutDashboard, group: "plan" },
  { key: "prd", label: "PRD", icon: FileText, group: "plan" },
  { key: "roadmap", label: "Roadmap", icon: KanbanSquare, group: "plan" },
  { key: "screens", label: "Screens", icon: Eye, group: "plan" },
  { key: "api", label: "API Plan", icon: Network, group: "plan" },
  { key: "database", label: "Database", icon: Database, group: "plan" },
  { key: "testing", label: "Testing", icon: FlaskConical, group: "plan" },
  { key: "deployment", label: "Deployment Plan", icon: Rocket, group: "plan" },
  { key: "export", label: "Docs Export", icon: Download, group: "plan" },
  { key: "prompt", label: "Build Prompt", icon: Sparkles, group: "plan" },
];

const ARTIFACT_GET = {
  prd: (pid) => `/projects/${pid}/prd`,
  features: (pid) => `/projects/${pid}/features`,
  screens: (pid) => `/projects/${pid}/screens`,
  apis: (pid) => `/projects/${pid}/api-plans`,
  schemas: (pid) => `/projects/${pid}/schemas`,
  testing: (pid) => `/projects/${pid}/checklists/testing`,
  deployment: (pid) => `/projects/${pid}/checklists/deployment`,
  build_prompt: (pid) => `/projects/${pid}/build-prompt`,
};

const artifactTimestamp = (data) => {
  if (!data) return null;
  if (Array.isArray(data)) return data.length ? data[0].created_at : null;
  return data.updated_at || data.created_at;
};

export default function Workspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
  // Code-builder state
  const [files, setFiles] = useState([]);
  const [tree, setTree] = useState([]);
  const [codebase, setCodebase] = useState(null);
  const [buildCheck, setBuildCheck] = useState(null);
  const [codeGenLoading, setCodeGenLoading] = useState(false);
  const [buildCheckRunning, setBuildCheckRunning] = useState(false);
  const [chatRefreshSignal, setChatRefreshSignal] = useState(0);
  // Planning state
  const [prd, setPrd] = useState(null);
  const [features, setFeatures] = useState([]);
  const [screens, setScreens] = useState([]);
  const [apis, setApis] = useState([]);
  const [schemas, setSchemas] = useState([]);
  const [testing, setTesting] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [buildPrompt, setBuildPrompt] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("code");
  const [generating, setGenerating] = useState({});
  const autoGenRef = useRef(false);

  const refreshProject = useCallback(() => {
    api.get(`/projects/${projectId}`).then((res) => setProject(res.data)).catch(() => {});
  }, [projectId]);

  const refreshHistory = useCallback(() => {
    api.get(`/projects/${projectId}/history`).then((res) => setHistory(res.data)).catch(() => {});
  }, [projectId]);

  const refreshCodebase = useCallback(async () => {
    try {
      const [treeRes, filesRes, codeRes, bcRes] = await Promise.allSettled([
        api.get(`/projects/${projectId}/files/tree`),
        api.get(`/projects/${projectId}/files`),
        api.get(`/projects/${projectId}/codebase`),
        api.get(`/projects/${projectId}/build-check`),
      ]);
      if (treeRes.status === "fulfilled") setTree(treeRes.value.data.tree || []);
      if (filesRes.status === "fulfilled") setFiles(filesRes.value.data || []);
      if (codeRes.status === "fulfilled") setCodebase(codeRes.value.data);
      if (bcRes.status === "fulfilled") setBuildCheck(bcRes.value.data);
    } catch {
      // ignore
    }
  }, [projectId]);

  // Loaded files with content (lazy on demand)
  const [filesWithContent, setFilesWithContent] = useState([]);
  const loadFilesWithContent = useCallback(async () => {
    try {
      const list = await api.get(`/projects/${projectId}/files`);
      const items = list.data || [];
      // Fetch content in parallel batches of 10
      const filled = [];
      const batchSize = 10;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((f) =>
            api
              .get(`/projects/${projectId}/files/content`, { params: { path: f.file_path } })
              .then((r) => r.data)
              .catch(() => ({ ...f, content: "" }))
          )
        );
        filled.push(...results);
      }
      setFilesWithContent(filled);
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const projRes = await api.get(`/projects/${projectId}`);
      setProject(projRes.data);
      const [
        prdR, featR, scrR, apiR, schR, testR, depR, bpR, histR,
        treeR, filesR, codeR, bcR,
      ] = await Promise.allSettled([
        api.get(`/projects/${projectId}/prd`),
        api.get(`/projects/${projectId}/features`),
        api.get(`/projects/${projectId}/screens`),
        api.get(`/projects/${projectId}/api-plans`),
        api.get(`/projects/${projectId}/schemas`),
        api.get(`/projects/${projectId}/checklists/testing`),
        api.get(`/projects/${projectId}/checklists/deployment`),
        api.get(`/projects/${projectId}/build-prompt`),
        api.get(`/projects/${projectId}/history`),
        api.get(`/projects/${projectId}/files/tree`),
        api.get(`/projects/${projectId}/files`),
        api.get(`/projects/${projectId}/codebase`),
        api.get(`/projects/${projectId}/build-check`),
      ]);
      if (prdR.status === "fulfilled") setPrd(prdR.value.data);
      if (featR.status === "fulfilled") setFeatures(featR.value.data || []);
      if (scrR.status === "fulfilled") setScreens(scrR.value.data || []);
      if (apiR.status === "fulfilled") setApis(apiR.value.data || []);
      if (schR.status === "fulfilled") setSchemas(schR.value.data || []);
      if (testR.status === "fulfilled") setTesting(testR.value.data);
      if (depR.status === "fulfilled") setDeployment(depR.value.data);
      if (bpR.status === "fulfilled") setBuildPrompt(bpR.value.data);
      if (histR.status === "fulfilled") setHistory(histR.value.data || []);
      if (treeR.status === "fulfilled") setTree(treeR.value.data.tree || []);
      if (filesR.status === "fulfilled") setFiles(filesR.value.data || []);
      if (codeR.status === "fulfilled") setCodebase(codeR.value.data);
      if (bcR.status === "fulfilled") setBuildCheck(bcR.value.data);
    } catch (e) {
      if (e.response?.status === 404) {
        toast.error("Project not found");
        navigate("/dashboard");
        return;
      }
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    setActiveTab("code");
    autoGenRef.current = false;
    loadAll();
  }, [loadAll]);

  // Load files with content when entering preview tab
  useEffect(() => {
    if (activeTab === "preview" && files.length > 0 && filesWithContent.length !== files.length) {
      loadFilesWithContent();
    }
  }, [activeTab, files, filesWithContent.length, loadFilesWithContent]);

  // Recovery polling for proxy-killed long calls
  const recoverGeneration = useCallback(
    async (type, startedAtMs) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        await new Promise((r) => setTimeout(r, 10000));
        try {
          const res = await api.get(ARTIFACT_GET[type](projectId));
          const ts = artifactTimestamp(res.data);
          if (ts && new Date(ts).getTime() >= startedAtMs - 60000) {
            return { ok: true, data: res.data };
          }
        } catch {
          // keep polling
        }
      }
      return { ok: false };
    },
    [projectId]
  );

  const applyResult = useCallback((data) => {
    if (data.type === "prd") setPrd(data.prd);
    else if (data.type === "features") setFeatures(data.features);
    else if (data.type === "screens") setScreens(data.screens);
    else if (data.type === "apis") setApis(data.apis);
    else if (data.type === "schemas") setSchemas(data.schemas);
    else if (data.type === "testing") setTesting(data.checklist);
    else if (data.type === "deployment") setDeployment(data.checklist);
    else if (data.type === "build_prompt") setBuildPrompt(data.build_prompt);
  }, []);

  const generateSection = useCallback(
    async (type, mode = "generate", quiet = false) => {
      const startedAtMs = Date.now();
      setGenerating((g) => ({ ...g, [type]: true }));
      try {
        const res = await api.post(`/projects/${projectId}/generate/${type}`, { mode });
        applyResult(res.data);
        refreshProject();
        refreshHistory();
        if (!quiet) toast.success(`${GEN_LABELS[type]} generated`);
        return true;
      } catch (e) {
        const backendDetail = e.response?.data?.detail;
        if (!backendDetail) {
          if (!quiet) toast.info(`${GEN_LABELS[type]} is taking longer than usual — still working…`);
          const recovered = await recoverGeneration(type, startedAtMs);
          if (recovered.ok) {
            refreshProject();
            refreshHistory();
            if (!quiet) toast.success(`${GEN_LABELS[type]} generated`);
            return true;
          }
        }
        toast.error(backendDetail || `Failed to generate ${GEN_LABELS[type]}.`);
        return false;
      } finally {
        setGenerating((g) => ({ ...g, [type]: false }));
      }
    },
    [projectId, applyResult, recoverGeneration, refreshProject, refreshHistory]
  );

  const generateCodebase = useCallback(async () => {
    setCodeGenLoading(true);
    toast.info("Generating full codebase — this can take 1–3 minutes.");
    try {
      // Kick off background generation
      await api.post(`/projects/${projectId}/codebase/generate`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to start generation");
      setCodeGenLoading(false);
      return;
    }
    // Poll until completed/failed
    let polls = 0;
    const maxPolls = 60; // 60 * 4s = 4 minutes
    let lastFileCount = 0;
    while (polls < maxPolls) {
      await new Promise((r) => setTimeout(r, 4000));
      polls += 1;
      try {
        const rec = await api.get(`/projects/${projectId}/codebase`);
        const data = rec.data;
        if (!data) continue;
        if (data.live_file_count && data.live_file_count !== lastFileCount) {
          lastFileCount = data.live_file_count;
          await refreshCodebase();
        }
        if (data.status === "completed") {
          await refreshCodebase();
          await loadFilesWithContent();
          refreshProject();
          toast.success(`Codebase generated — ${data.file_count} files`);
          setCodeGenLoading(false);
          return;
        }
        if (data.status === "failed") {
          toast.error(`Generation failed: ${data.error || "Unknown error"}`);
          setCodeGenLoading(false);
          return;
        }
      } catch {
        // ignore transient errors
      }
    }
    toast.warning("Generation is still running in the background. Refresh in a moment.");
    setCodeGenLoading(false);
    await refreshCodebase();
    await loadFilesWithContent();
    refreshProject();
  }, [projectId, refreshCodebase, loadFilesWithContent, refreshProject]);

  const runBuildCheck = useCallback(async () => {
    setBuildCheckRunning(true);
    try {
      const res = await api.post(`/projects/${projectId}/build-check`);
      setBuildCheck(res.data);
      refreshProject();
      toast.success("Build checks ran");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Build check failed");
    } finally {
      setBuildCheckRunning(false);
    }
  }, [projectId, refreshProject]);

  // Auto-generate on first load if asked
  useEffect(() => {
    if (!loading && project && searchParams.get("generate") === "1" && !autoGenRef.current) {
      autoGenRef.current = true;
      setSearchParams({}, { replace: true });
      generateCodebase();
    }
  }, [loading, project, searchParams, setSearchParams, generateCodebase]);

  const updateFeature = useCallback(
    async (featureId, updates) => {
      const prev = features;
      setFeatures((fs) => fs.map((f) => (f.feature_id === featureId ? { ...f, ...updates } : f)));
      try {
        const res = await api.put(`/projects/${projectId}/features/${featureId}`, updates);
        setFeatures((fs) => fs.map((f) => (f.feature_id === featureId ? res.data : f)));
        refreshProject();
      } catch {
        setFeatures(prev);
        toast.error("Failed to update module");
      }
    },
    [projectId, features, refreshProject]
  );

  const toggleChecklistItem = useCallback(
    async (ctype, itemId, checked) => {
      const setter = ctype === "testing" ? setTesting : setDeployment;
      setter((cl) =>
        cl ? { ...cl, items: cl.items.map((i) => (i.item_id === itemId ? { ...i, checked } : i)) } : cl
      );
      try {
        const res = await api.put(`/projects/${projectId}/checklists/${ctype}/items/${itemId}`, { checked });
        setter(res.data);
      } catch {
        setter((cl) =>
          cl ? { ...cl, items: cl.items.map((i) => (i.item_id === itemId ? { ...i, checked: !checked } : i)) } : cl
        );
        toast.error("Failed to update checklist");
      }
    },
    [projectId]
  );

  const savePrd = useCallback(
    async (content) => {
      try {
        const res = await api.put(`/projects/${projectId}/prd`, { content_markdown: content });
        setPrd(res.data);
        toast.success(`PRD saved (v${res.data.version})`);
        return true;
      } catch {
        toast.error("Failed to save PRD");
        return false;
      }
    },
    [projectId]
  );

  const updateProjectStatus = useCallback(
    async (status) => {
      try {
        const res = await api.put(`/projects/${projectId}`, { status });
        setProject(res.data);
      } catch {
        toast.error("Failed to update status");
      }
    },
    [projectId]
  );

  const exportZip = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/codebase/export/zip`, { responseType: "blob" });
      const slug = (project?.title || "omnivibe-app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      saveAs(new Blob([res.data], { type: "application/zip" }), `${slug || "omnivibe-app"}.zip`);
      toast.success("ZIP downloaded");
    } catch {
      toast.error("Failed to download ZIP");
    }
  }, [projectId, project]);

  const exportBundle = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/codebase/export/bundle`, { responseType: "blob" });
      const slug = (project?.title || "omnivibe-app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      saveAs(new Blob([res.data], { type: "text/markdown" }), `${slug || "omnivibe-app"}-codebase.md`);
      toast.success("Markdown bundle downloaded");
    } catch {
      toast.error("Failed to download bundle");
    }
  }, [projectId, project]);

  if (loading || !project) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row">
        <AppSidebar />
        <div className="flex flex-1 items-center justify-center" data-testid="workspace-loading">
          <Loader2 className="h-6 w-6 animate-spin text-[#FF4400]" />
        </div>
      </div>
    );
  }

  const counts = {
    features: features.length,
    screens: screens.length,
    apis: apis.length,
    schemas: schemas.length,
  };

  const hasCode = files.length > 0;
  const buildStatus = buildCheck?.status || project.build_status || "not_ready";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row" data-testid="workspace-page">
      <AppSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border px-6 pt-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="truncate font-heading text-xl font-bold tracking-tight" data-testid="workspace-title">
                  {project.title}
                </h1>
                <span className="hidden rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                  {project.project_type}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    BUILD_STATUS_STYLES[buildStatus] || "bg-muted text-muted-foreground border-border"
                  }`}
                  data-testid="workspace-build-status"
                >
                  {BUILD_STATUS_LABELS[buildStatus] || "Not generated"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground" data-testid="workspace-file-count">
                {files.length} files
              </span>
              <Select value={project.status} onValueChange={updateProjectStatus}>
                <SelectTrigger className="h-8 w-32 text-xs" data-testid="project-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto" data-testid="workspace-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                data-testid={`workspace-tab-${t.key}`}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  activeTab === t.key
                    ? "border-[#FF4400] font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                } ${t.group === "plan" ? "opacity-70" : ""}`}
              >
                <t.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "code" && (
            <CodeTab
              projectId={projectId}
              tree={tree}
              files={files}
              generating={codeGenLoading}
              onGenerate={generateCodebase}
              onReload={refreshCodebase}
            />
          )}
          {activeTab === "preview" && (
            <PreviewTab
              codebase={codebase}
              files={filesWithContent.length ? filesWithContent : []}
              buildCheck={buildCheck}
              onRefresh={async () => {
                await loadFilesWithContent();
                await refreshCodebase();
              }}
              refreshing={false}
            />
          )}
          {activeTab === "chat" && (
            <ChatTab
              projectId={projectId}
              hasCode={hasCode}
              onCodebaseChanged={async () => {
                await refreshCodebase();
                await loadFilesWithContent();
                setChatRefreshSignal((s) => s + 1);
              }}
              refreshSignal={chatRefreshSignal}
            />
          )}
          {activeTab === "build" && (
            <BuildStatusTab buildCheck={buildCheck} running={buildCheckRunning} onRun={runBuildCheck} />
          )}
          {activeTab === "deploy" && (
            <DeploymentTab
              project={project}
              buildCheck={buildCheck}
              fileCount={files.length}
              onExportZip={exportZip}
              onExportBundle={exportBundle}
              onNavigateBuild={() => setActiveTab("build")}
            />
          )}
          {activeTab === "export-code" && (
            <CodebaseExportTab project={project} files={files} buildPromptAvailable={!!buildPrompt} />
          )}

          {/* Planning supporting tabs */}
          {activeTab === "overview" && (
            <OverviewTab
              project={project}
              prd={prd}
              counts={counts}
              testing={testing}
              deployment={deployment}
              blueprintSteps={null}
              onGenerateBlueprint={() => generateSection("prd", "generate")}
              onNavigateTab={setActiveTab}
            />
          )}
          {activeTab === "prd" && (
            <PRDTab prd={prd} generating={generating.prd} onGenerate={(mode) => generateSection("prd", mode)} onSave={savePrd} />
          )}
          {activeTab === "roadmap" && (
            <RoadmapTab
              features={features}
              generating={generating.features}
              onGenerate={() => generateSection("features")}
              onUpdateFeature={updateFeature}
            />
          )}
          {activeTab === "screens" && (
            <ScreensTab screens={screens} generating={generating.screens} onGenerate={() => generateSection("screens")} />
          )}
          {activeTab === "api" && (
            <ApiTab apis={apis} generating={generating.apis} onGenerate={() => generateSection("apis")} />
          )}
          {activeTab === "database" && (
            <SchemaTab schemas={schemas} generating={generating.schemas} onGenerate={() => generateSection("schemas")} />
          )}
          {activeTab === "testing" && (
            <ChecklistTab
              type="testing"
              checklist={testing}
              generating={generating.testing}
              onGenerate={() => generateSection("testing")}
              onToggle={(itemId, checked) => toggleChecklistItem("testing", itemId, checked)}
            />
          )}
          {activeTab === "deployment" && (
            <ChecklistTab
              type="deployment"
              checklist={deployment}
              generating={generating.deployment}
              onGenerate={() => generateSection("deployment")}
              onToggle={(itemId, checked) => toggleChecklistItem("deployment", itemId, checked)}
            />
          )}
          {activeTab === "export" && (
            <ExportTab
              project={project}
              availability={{
                prd: !!prd,
                features: features.length > 0,
                apis: apis.length > 0,
                schemas: schemas.length > 0,
                testing: !!testing,
                deployment: !!deployment,
                blueprint: !!prd || features.length > 0,
              }}
            />
          )}
          {activeTab === "prompt" && (
            <BuildPromptTab
              buildPrompt={buildPrompt}
              generating={generating.build_prompt}
              onGenerate={() => generateSection("build_prompt")}
            />
          )}
        </div>
      </main>

      <AIPanel
        activeTab={activeTab}
        generating={generating}
        codeGenLoading={codeGenLoading}
        buildCheck={buildCheck}
        fileCount={files.length}
        history={history}
        hasPrd={!!prd}
        hasCode={hasCode}
        onGenerate={generateSection}
        onGenerateCodebase={generateCodebase}
        onRunBuildCheck={runBuildCheck}
        onNavigate={setActiveTab}
      />
    </div>
  );
}
