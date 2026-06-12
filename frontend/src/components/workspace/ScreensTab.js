import { AlertTriangle, Loader2, Monitor, MousePointerClick, Smartphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

function StateBlock({ label, text, color }) {
  return (
    <div className="rounded-md bg-muted/50 p-2.5">
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${color}`}>{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text || "—"}</p>
    </div>
  );
}

export default function ScreensTab({ screens, generating, onGenerate }) {
  if (screens.length === 0) {
    return (
      <EmptyState
        icon={Monitor}
        title="No screen plan yet"
        description="Generate a screen-by-screen plan — components, user actions, empty/error/loading states, and responsive behavior notes for every screen."
        actionLabel="Generate screen plan"
        onAction={onGenerate}
        busy={generating}
        testId="screens-empty-state"
      />
    );
  }

  return (
    <div className="grid gap-5 animate-fade-up lg:grid-cols-2" data-testid="screens-tab">
      {screens.map((s) => (
        <div key={s.screen_id} className="rounded-xl border border-border bg-card p-6" data-testid={`screen-card-${s.screen_id}`}>
          <div className="flex items-center gap-2.5">
            <Monitor className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
            <h3 className="font-heading text-base font-bold">{s.screen_name}</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{s.purpose}</p>

          {s.components?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">Components</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.components.map((c, i) => (
                  <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {s.user_actions?.length > 0 && (
            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                <MousePointerClick className="h-3 w-3" strokeWidth={1.5} /> User actions
              </p>
              <ul className="mt-2 space-y-1">
                {s.user_actions.map((a, i) => (
                  <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4400]" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <StateBlock label="Empty" text={s.empty_state} color="text-zinc-500 dark:text-zinc-400" />
            <StateBlock label="Loading" text={s.loading_state} color="text-blue-600 dark:text-blue-400" />
            <StateBlock label="Error" text={s.error_state} color="text-red-600 dark:text-red-400" />
          </div>

          {s.responsive_notes && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-2.5">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-xs leading-relaxed text-muted-foreground">{s.responsive_notes}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
