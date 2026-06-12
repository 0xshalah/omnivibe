import { Check, CircleDashed, Loader2, Sparkles, X, Zap } from "lucide-react";
import { GEN_LABELS } from "@/lib/labels";
import { formatDistanceToNow } from "date-fns";

const TAB_ACTIONS = {
  overview: [],
  prd: [
    { type: "prd", mode: "generate", label: "Generate PRD", primary: true },
    { type: "prd", mode: "improve", label: "Improve PRD", requiresPrd: true },
    { type: "prd", mode: "technical", label: "Make more technical", requiresPrd: true },
    { type: "prd", mode: "simpler", label: "Make simpler", requiresPrd: true },
  ],
  roadmap: [{ type: "features", label: "Generate feature modules", primary: true }],
  screens: [{ type: "screens", label: "Generate screen plan", primary: true }],
  api: [{ type: "apis", label: "Generate API plan", primary: true }],
  database: [{ type: "schemas", label: "Generate MongoDB schema", primary: true }],
  testing: [{ type: "testing", label: "Generate testing checklist", primary: true }],
  deployment: [{ type: "deployment", label: "Generate deployment checklist", primary: true }],
  export: [],
  prompt: [{ type: "build_prompt", label: "Generate build prompt", primary: true }],
};

const BLUEPRINT_ORDER = ["prd", "features", "screens", "apis", "schemas", "testing", "deployment"];

function StepIcon({ state }) {
  if (state === "done") return <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />;
  if (state === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FF4400]" />;
  if (state === "error") return <X className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />;
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />;
}

export default function AIPanel({
  activeTab,
  generating,
  blueprintSteps,
  history,
  hasPrd,
  onGenerate,
  onGenerateBlueprint,
}) {
  const actions = TAB_ACTIONS[activeTab] || [];
  const anyGenerating = Object.values(generating).some(Boolean);
  const blueprintRunning = blueprintSteps && Object.values(blueprintSteps).some((s) => s === "running" || s === "pending");

  return (
    <aside
      className="hidden w-80 shrink-0 flex-col border-l border-border bg-panel lg:flex"
      data-testid="ai-panel"
    >
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4400]/10">
            <Sparkles className={`h-4 w-4 text-[#FF4400] ${anyGenerating ? "ai-pulse" : ""}`} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold">AI Assistant</h3>
            <p className="text-xs text-muted-foreground">Contextual generation actions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {actions.length > 0 && (
          <div>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              For this section
            </p>
            <div className="space-y-2">
              {actions.map((a) => {
                const busy = generating[a.type];
                const disabled = busy || blueprintRunning || (a.requiresPrd && !hasPrd);
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
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    )}
                    {busy ? "Generating…" : a.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Full blueprint
          </p>
          <button
            onClick={onGenerateBlueprint}
            disabled={anyGenerating || blueprintRunning}
            data-testid="ai-generate-blueprint-button"
            className="flex w-full items-center gap-2 rounded-md border border-[#FF4400]/40 bg-[#FF4400]/10 px-3.5 py-2.5 text-left text-sm font-medium text-[#FF4400] transition-all hover:bg-[#FF4400]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            {blueprintRunning ? "Generating blueprint…" : "Generate full blueprint"}
          </button>

          {blueprintSteps && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-card p-3.5" data-testid="blueprint-progress">
              {BLUEPRINT_ORDER.map((k) => (
                <div key={k} className="flex items-center gap-2.5 text-xs">
                  <StepIcon state={blueprintSteps[k]} />
                  <span className={blueprintSteps[k] === "pending" ? "text-muted-foreground/60" : "text-foreground"}>
                    {GEN_LABELS[k]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Generation history
          </p>
          {history.length === 0 ? (
            <p className="text-xs text-muted-foreground/70">Nothing generated yet.</p>
          ) : (
            <div className="space-y-1.5" data-testid="generation-history">
              {history.slice(0, 12).map((h) => (
                <div
                  key={h.history_id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                >
                  <span className="text-xs">{GEN_LABELS[h.generation_type?.split(":")[0]] || h.generation_type}</span>
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
