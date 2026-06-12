import { useState } from "react";
import { GitBranch, KanbanSquare, ListChecks } from "lucide-react";
import { FEATURE_COLUMNS, PRIORITY_STYLES } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function FeatureCard({ feature, onOpen, onDragStart }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, feature.feature_id)}
      onClick={() => onOpen(feature)}
      data-testid={`feature-card-${feature.feature_id}`}
      className="cursor-pointer rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-muted-foreground/40 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug">{feature.title}</h4>
        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLES[feature.priority]}`}>
          {feature.priority}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{feature.description}</p>
      <div className="mt-2.5 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ListChecks className="h-3 w-3" strokeWidth={1.5} />
          {feature.acceptance_criteria?.length || 0}
        </span>
        {feature.dependencies?.length > 0 && (
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" strokeWidth={1.5} />
            {feature.dependencies.length}
          </span>
        )}
      </div>
    </div>
  );
}

export default function RoadmapTab({ features, generating, onGenerate, onUpdateFeature }) {
  const [selected, setSelected] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  if (features.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No feature modules yet"
        description="Generate the build roadmap — AI breaks your app into prioritized feature modules with acceptance criteria and dependencies, displayed on a Kanban board."
        actionLabel="Generate feature modules"
        onAction={onGenerate}
        busy={generating}
        testId="roadmap-empty-state"
      />
    );
  }

  const handleDragStart = (e, featureId) => {
    e.dataTransfer.setData("featureId", featureId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    setDragOver(null);
    const featureId = e.dataTransfer.getData("featureId");
    const feature = features.find((f) => f.feature_id === featureId);
    if (feature && feature.status !== status) {
      onUpdateFeature(featureId, { status });
    }
  };

  const selectedFeature = selected ? features.find((f) => f.feature_id === selected.feature_id) || selected : null;

  return (
    <div className="animate-fade-up" data-testid="roadmap-tab">
      <div className="flex gap-4 overflow-x-auto pb-4">
        {FEATURE_COLUMNS.map((col) => {
          const items = features.filter((f) => f.status === col.key);
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => handleDrop(e, col.key)}
              data-testid={`roadmap-column-${col.key}`}
              className={`flex w-64 shrink-0 flex-col rounded-xl p-3 transition-colors ${
                dragOver === col.key ? "bg-[#FF4400]/10 ring-1 ring-[#FF4400]/40" : "bg-muted/40"
              }`}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  {col.label}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  {items.length}
                </span>
              </div>
              <div className="min-h-[120px] space-y-2.5">
                {items.map((f) => (
                  <FeatureCard key={f.feature_id} feature={f} onOpen={setSelected} onDragStart={handleDragStart} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-lg" data-testid="feature-detail-dialog">
          {selectedFeature && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-lg font-bold">{selectedFeature.title}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{selectedFeature.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">Status</p>
                  <Select
                    value={selectedFeature.status}
                    onValueChange={(v) => onUpdateFeature(selectedFeature.feature_id, { status: v })}
                  >
                    <SelectTrigger data-testid="feature-status-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEATURE_COLUMNS.map((c) => (
                        <SelectItem key={c.key} value={c.key}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">Priority</p>
                  <Select
                    value={selectedFeature.priority}
                    onValueChange={(v) => onUpdateFeature(selectedFeature.feature_id, { priority: v })}
                  >
                    <SelectTrigger data-testid="feature-priority-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P0">P0 — Must have</SelectItem>
                      <SelectItem value="P1">P1 — Should have</SelectItem>
                      <SelectItem value="P2">P2 — Nice to have</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedFeature.acceptance_criteria?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Acceptance criteria
                  </p>
                  <ul className="space-y-1.5">
                    {selectedFeature.acceptance_criteria.map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#FF4400]" />
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedFeature.dependencies?.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                    Depends on
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFeature.dependencies.map((d, i) => (
                      <span key={i} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
