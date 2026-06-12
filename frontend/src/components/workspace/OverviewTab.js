import { format } from "date-fns";
import { Database, FlaskConical, KanbanSquare, Layers, Monitor, Network, Rocket, Zap } from "lucide-react";

function StatCard({ icon: Icon, label, value, onClick, testId }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-[1px] hover:bg-accent/50"
    >
      <Icon className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
      <p className="mt-3 font-heading text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function ChecklistSummary({ icon: Icon, label, checklist, onClick, testId }) {
  const total = checklist?.items?.length || 0;
  const done = checklist?.items?.filter((i) => i.checked).length || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="rounded-xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-[1px] hover:bg-accent/50"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {total ? `${done}/${total}` : "Not generated"}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[#FF4400] transition-all" style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

export default function OverviewTab({
  project,
  prd,
  counts,
  testing,
  deployment,
  blueprintSteps,
  onGenerateBlueprint,
  onNavigateTab,
}) {
  const nothingGenerated =
    !prd && counts.features === 0 && counts.screens === 0 && counts.apis === 0 && counts.schemas === 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-fade-up" data-testid="overview-tab">
      {nothingGenerated && !blueprintSteps && (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-[#FF4400]/30 bg-[#FF4400]/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold">Generate your project blueprint</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              One click generates the PRD, feature roadmap, screen plan, API plan, database schema, and checklists.
            </p>
          </div>
          <button
            onClick={onGenerateBlueprint}
            data-testid="overview-generate-blueprint-button"
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#FF4400] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
          >
            <Zap className="h-4 w-4" strokeWidth={1.5} />
            Generate blueprint
          </button>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-12">
        <div className="rounded-xl border border-border bg-card p-6 md:col-span-7">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">App idea</p>
          <p className="mt-3 text-sm leading-relaxed" data-testid="overview-idea">{project.idea}</p>
          {project.description && (
            <>
              <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Description</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{project.description}</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-6 md:col-span-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Project</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{project.project_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target users</span>
              <span className="max-w-[55%] truncate text-right">{project.target_users || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{format(new Date(project.created_at), "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated</span>
              <span>{format(new Date(project.updated_at), "MMM d, yyyy")}</span>
            </div>
            <div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Build progress</span>
                <span>{project.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-[#FF4400] transition-all" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <StatCard icon={KanbanSquare} label="Feature modules" value={counts.features} onClick={() => onNavigateTab("roadmap")} testId="overview-stat-features" />
        <StatCard icon={Monitor} label="Screens planned" value={counts.screens} onClick={() => onNavigateTab("screens")} testId="overview-stat-screens" />
        <StatCard icon={Network} label="API endpoints" value={counts.apis} onClick={() => onNavigateTab("api")} testId="overview-stat-apis" />
        <StatCard icon={Database} label="DB collections" value={counts.schemas} onClick={() => onNavigateTab("database")} testId="overview-stat-schemas" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <ChecklistSummary icon={FlaskConical} label="Testing checklist" checklist={testing} onClick={() => onNavigateTab("testing")} testId="overview-testing-summary" />
        <ChecklistSummary icon={Rocket} label="Deployment checklist" checklist={deployment} onClick={() => onNavigateTab("deployment")} testId="overview-deployment-summary" />
      </div>

      {prd && (
        <button
          onClick={() => onNavigateTab("prd")}
          data-testid="overview-prd-link"
          className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-5 text-left transition-all hover:bg-accent/50"
        >
          <div className="flex items-center gap-3">
            <Layers className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
            <div>
              <p className="text-sm font-medium">PRD document</p>
              <p className="text-xs text-muted-foreground">
                Version {prd.version} · {prd.content_markdown.split(/\s+/).length.toLocaleString()} words
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Open editor →</span>
        </button>
      )}
    </div>
  );
}
