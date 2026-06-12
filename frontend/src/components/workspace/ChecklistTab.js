import { FlaskConical, Rocket } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Checkbox } from "@/components/ui/checkbox";

const META = {
  testing: {
    icon: FlaskConical,
    title: "No testing checklist yet",
    description:
      "Generate an app-specific testing checklist — auth, forms, API routes, database operations, responsiveness, loading & error states, permissions, and deployment readiness.",
    action: "Generate testing checklist",
  },
  deployment: {
    icon: Rocket,
    title: "No deployment checklist yet",
    description:
      "Generate a practical deployment readiness checklist — env vars, database connection, auth, API routes, frontend build, error handling, mobile checks, and secret exposure.",
    action: "Generate deployment checklist",
  },
};

export default function ChecklistTab({ type, checklist, generating, onGenerate, onToggle }) {
  const meta = META[type];

  if (!checklist) {
    return (
      <EmptyState
        icon={meta.icon}
        title={meta.title}
        description={meta.description}
        actionLabel={meta.action}
        onAction={onGenerate}
        busy={generating}
        testId={`${type}-empty-state`}
      />
    );
  }

  const items = checklist.items || [];
  const done = items.filter((i) => i.checked).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const categories = [];
  for (const item of items) {
    if (!categories.includes(item.category)) categories.push(item.category);
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up" data-testid={`${type}-checklist-tab`}>
      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <meta.icon className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
            <span className="text-sm font-medium">
              {done} of {items.length} checks complete
            </span>
          </div>
          <span className="font-heading text-lg font-bold" data-testid={`${type}-progress-pct`}>
            {pct}%
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#FF4400] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-6">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="mb-2.5 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{cat}</p>
            <div className="space-y-1.5">
              {items
                .filter((i) => i.category === cat)
                .map((item) => (
                  <label
                    key={item.item_id}
                    data-testid={`checklist-item-${item.item_id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/50"
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(v) => onToggle(item.item_id, Boolean(v))}
                      className="mt-0.5 data-[state=checked]:border-[#FF4400] data-[state=checked]:bg-[#FF4400]"
                      data-testid={`checklist-checkbox-${item.item_id}`}
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        item.checked ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {item.text}
                    </span>
                  </label>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
