import { AlertCircle, CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { BUILD_STATUS_LABELS, BUILD_STATUS_STYLES } from "@/lib/codeLabels";

const ICONS = {
  pass: CheckCircle2,
  warn: ShieldAlert,
  fail: AlertCircle,
};
const ICON_COLORS = {
  pass: "text-emerald-500",
  warn: "text-amber-500",
  fail: "text-red-500",
};

export default function BuildStatusTab({ buildCheck, running, onRun }) {
  return (
    <div className="space-y-5" data-testid="build-status-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold tracking-tight">Build Readiness</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Static checks across generated files: dependencies, env vars, routes, deployment config.
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={running}
          data-testid="run-build-check"
          className="inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-4 py-2 text-sm font-medium text-white hover:bg-[#E63D00] disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />}
          {running ? "Running checks…" : "Run checks"}
        </button>
      </div>

      {!buildCheck ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/50" strokeWidth={1.2} />
          <p className="mt-3 text-sm">No build check yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Run checks to evaluate the codebase.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                BUILD_STATUS_STYLES[buildCheck.status] || "bg-muted text-muted-foreground"
              }`}
              data-testid="build-status-badge"
            >
              {BUILD_STATUS_LABELS[buildCheck.status] || buildCheck.status}
            </span>
            <span className="text-xs text-muted-foreground">
              {buildCheck.checks.length} checks · {buildCheck.fail_count} failed · {buildCheck.warn_count} warnings
              · {buildCheck.file_count} files
            </span>
          </div>

          <div className="space-y-1.5">
            {buildCheck.checks.map((c, i) => {
              const Icon = ICONS[c.status] || CheckCircle2;
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-3.5 py-2.5"
                  data-testid={`build-check-${i}`}
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ICON_COLORS[c.status]}`} strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{c.name}</p>
                    {c.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
