import { CheckCircle2, ExternalLink, FileText, Rocket, Server, ShieldCheck, Zap } from "lucide-react";
import { BUILD_STATUS_LABELS, BUILD_STATUS_STYLES } from "@/lib/codeLabels";

function StepCard({ icon: Icon, title, description, action, badge }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF4400]/12">
          <Icon className="h-5 w-5 text-[#FF4400]" strokeWidth={1.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold tracking-tight">{title}</h3>
            {badge}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export default function DeploymentTab({ project, buildCheck, fileCount, onExportZip, onExportBundle, onNavigateBuild }) {
  const status = buildCheck?.status || "not_ready";
  const deploymentReady = status === "deployment_ready" || status === "build_ready";

  return (
    <div className="space-y-6" data-testid="deployment-tab">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">Deployment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ship your generated app to Emergent or export a deploy-ready bundle.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            BUILD_STATUS_STYLES[status] || "bg-muted text-muted-foreground"
          }`}
          data-testid="deploy-readiness-badge"
        >
          {BUILD_STATUS_LABELS[status] || status}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StepCard
          icon={ShieldCheck}
          title="1. Verify build readiness"
          description="Make sure every required file, dependency, env var and route is in place before deploying."
          badge={
            <span className="text-[11px] text-muted-foreground">
              {fileCount} files
            </span>
          }
          action={
            <button
              onClick={onNavigateBuild}
              data-testid="deploy-open-build"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={1.5} />
              Open build checks
            </button>
          }
        />

        <StepCard
          icon={Zap}
          title="2. Deploy to Emergent"
          description="The fastest path: paste the generated build prompt into Emergent to build & host the app live."
          badge={
            project?.deployment_target === "Emergent" ? (
              <span className="rounded bg-[#FF4400]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#FF4400]">
                Preferred
              </span>
            ) : null
          }
          action={
            <a
              href="https://emergent.sh"
              target="_blank"
              rel="noreferrer"
              data-testid="deploy-emergent-link"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF4400] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E63D00]"
            >
              <ExternalLink className="h-3 w-3" />
              Open Emergent.sh
            </a>
          }
        />

        <StepCard
          icon={Rocket}
          title="3. Self-host with the ZIP"
          description="Download the full codebase, install deps locally, then deploy to Vercel + Render or your own infra."
          action={
            <button
              onClick={onExportZip}
              data-testid="deploy-zip-button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <Server className="h-3 w-3" strokeWidth={1.5} />
              Download ZIP
            </button>
          }
        />

        <StepCard
          icon={FileText}
          title="4. Markdown bundle"
          description="A single Markdown file with every file content fenced — perfect for archiving or sharing."
          action={
            <button
              onClick={onExportBundle}
              data-testid="deploy-bundle-button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-accent"
            >
              <FileText className="h-3 w-3" strokeWidth={1.5} />
              Download Markdown bundle
            </button>
          }
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">Environment variable checklist</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Add these to your hosting provider before launching. Example values are placeholders only.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { name: "MONGO_URL", note: "MongoDB connection string" },
            { name: "DB_NAME", note: "Database name" },
            { name: "VITE_API_BASE_URL", note: "Public backend URL for frontend" },
            { name: "CORS_ORIGINS", note: "Comma-separated allowed origins" },
          ].map((e) => (
            <div key={e.name} className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
              <code className="font-mono-code text-xs font-medium">{e.name}</code>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{e.note}</p>
            </div>
          ))}
        </div>
      </div>

      {deploymentReady && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
          This app passed the build checks and is ready to ship.
        </div>
      )}
    </div>
  );
}
