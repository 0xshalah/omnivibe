import { useState } from "react";
import { ChevronDown, Globe, Lock, Network } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const METHOD_STYLES = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  PATCH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export default function ApiTab({ apis, generating, onGenerate }) {
  const [expanded, setExpanded] = useState(null);

  if (apis.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title="No API plan yet"
        description="Generate the FastAPI endpoint plan — methods, routes, request/response shapes, error cases, and auth requirements."
        actionLabel="Generate API plan"
        onAction={onGenerate}
        busy={generating}
        testId="api-empty-state"
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-2.5 animate-fade-up" data-testid="api-tab">
      {apis.map((a) => {
        const open = expanded === a.api_id;
        return (
          <div key={a.api_id} className="overflow-hidden rounded-lg border border-border bg-card">
            <button
              onClick={() => setExpanded(open ? null : a.api_id)}
              data-testid={`api-row-${a.api_id}`}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
            >
              <span
                className={`w-16 shrink-0 rounded-md px-2 py-1 text-center font-mono text-xs font-semibold ${
                  METHOD_STYLES[a.method] || METHOD_STYLES.GET
                }`}
              >
                {a.method}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-sm">{a.route}</code>
              {a.auth_required ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={1.5} title="Auth required" />
              ) : (
                <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} title="Public" />
              )}
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                strokeWidth={1.5}
              />
            </button>
            {open && (
              <div className="space-y-3 border-t border-border px-4 py-4">
                <p className="text-sm text-muted-foreground">{a.purpose}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Request body
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed">
                      {a.request_body || "None"}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Response shape
                    </p>
                    <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed">
                      {a.response_shape || "—"}
                    </pre>
                  </div>
                </div>
                {a.error_cases?.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                      Error cases
                    </p>
                    <ul className="space-y-1">
                      {a.error_cases.map((e, i) => (
                        <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
