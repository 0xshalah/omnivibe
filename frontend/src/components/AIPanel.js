import { Code2, Eye, Loader2, MessageSquare, Rocket, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { GEN_LABELS } from "@/lib/labels";
import { BUILD_STATUS_LABELS } from "@/lib/codeLabels";
import { formatDistanceToNow } from "date-fns";

const PLANNING_TAB_ACTIONS = {
  prd: [
    { type: "prd", mode: "generate", label: "Generate PRD", primary: true },
    { type: "prd", mode: "improve", label: "Improve PRD", requiresPrd: true },
    { type: "prd", mode: "technical", label: "Make more technical", requiresPrd: true },
    { type: "prd", mode: "simpler", label: "Make simpler", requiresPrd: true },
  ],
  roadmap: [{ type: "features", label: "Generate feature roadmap", primary: true }],
  screens: [{ type: "screens", label: "Generate screen plan", primary: true }],
  api: [{ type: "apis", label: "Generate API plan", primary: true }],
  database: [{ type: "schemas", label: "Generate MongoDB schema", primary: true }],
  testing: [{ type: "testing", label: "Generate testing checklist", primary: true }],
  deployment: [{ type: "deployment", label: "Generate deployment checklist", primary: true }],
  prompt: [{ type: "build_prompt", label: "Generate build prompt", primary: true }],
};

const QUICK_NAV = [
  { to: "code", label: "Code", icon: Code2 },
  { to: "preview", label: "Live preview", icon: Eye },
  { to: "chat", label: "AI chat", icon: MessageSquare },
  { to: "build", label: "Build checks", icon: ShieldCheck },
  { to: "deploy", label: "Deploy", icon: Rocket },
];

export default function AIPanel({
  activeTab,
  generating,
  codeGenLoading,
  buildCheck,
  fileCount,
  history,
  hasPrd,
  hasCode,
  onGenerate,
  onGenerateCodebase,
  onRunBuildCheck,
  onNavigate,
}) {
  const actions = PLANNING_TAB_ACTIONS[activeTab] || [];
  const anyGenerating = Object.values(generating || {}).some(Boolean) || codeGenLoading;
  const isBuildTab = ["code", "preview", "chat", "build", "deploy", "export-code"].includes(activeTab);

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col border-l border-border bg-panel lg:flex"
      data-testid="ai-panel"
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4400]/10">
            <Sparkles className={`h-4 w-4 text-[#FF4400] ${anyGenerating ? "ai-pulse" : ""}`} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold">AI Code Builder</h3>
            <p className="text-xs text-muted-foreground">GPT-5.5 · contextual actions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Quick build status card */}
        <div className="rounded-lg border border-border bg-card p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Project state
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground">Files</p>
              <p className="font-semibold" data-testid="aipanel-file-count">{fileCount || 0}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Build</p>
              <p className="truncate font-semibold">
                {buildCheck ? BUILD_STATUS_LABELS[buildCheck.status] : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Primary actions */}
        {isBuildTab && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Code builder
            </p>
            <button
              onClick={onGenerateCodebase}
              disabled={anyGenerating}
              data-testid="aipanel-generate-codebase"
              className="flex w-full items-center gap-2 rounded-md bg-[#FF4400] px-3.5 py-2.5 text-left text-sm font-medium text-white hover:bg-[#E63D00] disabled:opacity-50"
            >
              {codeGenLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" strokeWidth={1.5} />}
              {codeGenLoading ? "Generating codebase…" : hasCode ? "Regenerate codebase" : "Generate codebase"}
            </button>
            <button
              onClick={onRunBuildCheck}
              disabled={anyGenerating || !hasCode}
              data-testid="aipanel-build-check"
              className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
              Run build checks
            </button>
          </div>
        )}

        {/* Planning actions for plan tabs */}
        {!isBuildTab && actions.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              For this section
            </p>
            <div className="space-y-2">
              {actions.map((a) => {
                const busy = generating?.[a.type];
                const disabled = busy || anyGenerating || (a.requiresPrd && !hasPrd);
                return (
                  <button
                    key={`${a.type}-${a.mode || "x"}`}
                    onClick={() => onGenerate(a.type, a.mode || "generate")}
                    disabled={disabled}
                    data-testid={`ai-action-${a.type}${a.mode ? `-${a.mode}` : ""}`}
                    className={`flex w-full items-center gap-2 rounded-md px-3.5 py-2.5 text-left text-sm transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                      a.primary
                        ? "bg-[#FF4400] font-medium text-white hover:bg-[#E63D00]"
                        : "border border-border bg-card text-foreground hover:bg-accent"
                    }`}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />}
                    {busy ? "Generating…" : a.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick navigation */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Jump to
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_NAV.map((q) => (
              <button
                key={q.to}
                onClick={() => onNavigate(q.to)}
                data-testid={`aipanel-jump-${q.to}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-accent"
              >
                <q.icon className="h-3 w-3" strokeWidth={1.5} />
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent AI activity */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent AI activity
          </p>
          {history?.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">No activity yet.</p>
          ) : (
            <div className="space-y-1.5" data-testid="generation-history">
              {history?.slice(0, 8).map((h) => (
                <div
                  key={h.history_id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="text-xs">
                    {GEN_LABELS[h.generation_type?.split(":")[0]] || h.generation_type}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
