import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import {
  Database,
  Download,
  FileText,
  FlaskConical,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  Monitor,
  Network,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { GEN_LABELS, STATUS_LABELS } from "@/lib/labels";
import AppSidebar from "@/components/AppSidebar";
import AIPanel from "@/components/AIPanel";
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

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "prd", label: "PRD Editor", icon: FileText },
  { key: "roadmap", label: "Roadmap", icon: KanbanSquare },
  { key: "screens", label: "Screens", icon: Monitor },
  { key: "api", label: "API Plan", icon: Network },
  { key: "database", label: "Database", icon: Database },
  { key: "testing", label: "Testing", icon: FlaskConical },
  { key: "deployment", label: "Deployment", icon: Rocket },
  { key: "export", label: "Export", icon: Download },
  { key: "prompt", label: "Build Prompt", icon: Sparkles },
];

const BLUEPRINT_STEPS = ["prd", "features", "screens", "apis", "schemas", "testing", "deployment"];

export default function Workspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [project, setProject] = useState(null);
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
  const [activeTab, setActiveTab] = useState("overview");
  const [generating, setGenerating] = useState({});
  const [blueprintSteps, setBlueprintSteps] = useState(null);
  const autoGenRef = useRef(false);

  const refreshProject = useCallback(() => {
    api.get(`/projects/${projectId}`).then((res) => setProject(res.data)).catch(() => {});
  }, [projectId]);

  const refreshHistory = useCallback(() => {
    api.get(`/projects/${projectId}/history`).then((res) => setHistory(res.data)).catch(() => {});
  }, [projectId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const projRes = await api.get(`/projects/${projectId}`);
      setProject(projRes.data);
      const [prdR, featR, scrR, apiR, schR, testR, depR, bpR, histR] = await Promise.allSettled([
        api.get(`/projects/${projectId}/prd`),
        api.get(`/projects/${projectId}/features`),
        api.get(`/projects/${projectId}/screens`),
        api.get(`/projects/${projectId}/api-plans`),
        api.get(`/projects/${projectId}/schemas`),
        api.get(`/projects/${projectId}/checklists/testing`),
        api.get(`/projects/${projectId}/checklists/deployment`),
        api.get(`/projects/${projectId}/build-prompt`),
        api.get(`/projects/${projectId}/history`),
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
    setActiveTab("overview");
    setBlueprintSteps(null);
    autoGenRef.current = false;
    loadAll();
  }, [loadAll]);

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
      setGenerating((g) => ({ ...g, [type]: true }));
      try {
        const res = await api.post(`/projects/${projectId}/generate/${type}`, { mode });
        applyResult(res.data);
        refreshProject();
        refreshHistory();
        if (!quiet) toast.success(`${GEN_LABELS[type]} generated`);
        return true;
      } catch (e) {
        toast.error(e.response?.data?.detail || `Failed to generate ${GEN_LABELS[type]}. Please try again.`);
        return false;
      } finally {
        setGenerating((g) => ({ ...g, [type]: false }));
      }
    },
    [projectId, applyResult, refreshProject, refreshHistory]
  );

  const generateBlueprint = useCallback(async () => {
    const initial = Object.fromEntries(BLUEPRINT_STEPS.map((k) => [k, "pending"]));
    setBlueprintSteps({ ...initial, prd: "running" });
    toast.info("Generating the full project blueprint — this takes a few minutes.");
    const prdOk = await generateSection("prd", "generate", true);
    setBlueprintSteps((s) => ({ ...s, prd: prdOk ? "done" : "error" }));
    const rest = BLUEPRINT_STEPS.slice(1);
    setBlueprintSteps((s) => ({ ...s, ...Object.fromEntries(rest.map((k) => [k, "running"])) }));
    await Promise.allSettled(
      rest.map(async (k) => {
        const ok = await generateSection(k, "generate", true);
        setBlueprintSteps((s) => ({ ...s, [k]: ok ? "done" : "error" }));
      })
    );
    toast.success("Project blueprint ready");
    setTimeout(() => setBlueprintSteps(null), 6000);
  }, [generateSection]);

  useEffect(() => {
    if (!loading && project && searchParams.get("generate") === "1" && !autoGenRef.current) {
      autoGenRef.current = true;
      setSearchParams({}, { replace: true });
      generateBlueprint();
    }
  }, [loading, project, searchParams, setSearchParams, generateBlueprint]);

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row" data-testid="workspace-page">
      <AppSidebar />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border px-6 pt-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="truncate font-heading text-xl font-bold tracking-tight" data-testid="workspace-title">
                  {project.title}
                </h1>
                <span className="hidden rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                  {project.project_type}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#FF4400]" style={{ width: `${project.progress}%` }} />
                </div>
                <span className="text-xs text-muted-foreground" data-testid="workspace-progress">
                  {project.progress}%
                </span>
              </div>
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

          <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto" data-testid="workspace-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                data-testid={`workspace-tab-${t.key}`}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  activeTab === t.key
                    ? "border-foreground font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === "overview" && (
            <OverviewTab
              project={project}
              prd={prd}
              counts={counts}
              testing={testing}
              deployment={deployment}
              blueprintSteps={blueprintSteps}
              onGenerateBlueprint={generateBlueprint}
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
        blueprintSteps={blueprintSteps}
        history={history}
        hasPrd={!!prd}
        onGenerate={generateSection}
        onGenerateBlueprint={generateBlueprint}
      />
    </div>
  );
}
