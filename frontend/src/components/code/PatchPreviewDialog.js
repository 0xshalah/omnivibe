import { Check, FileCode, Loader2, Minus, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function FileRow({ icon: Icon, color, file, onSelect }) {
  return (
    <button
      onClick={() => onSelect && onSelect(file)}
      className={`flex w-full items-start gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-left transition-colors hover:bg-accent ${
        onSelect ? "cursor-pointer" : "cursor-default"
      }`}
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${color}`} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono-code text-xs text-foreground">{file.path}</p>
        {file.reason && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{file.reason}</p>}
      </div>
    </button>
  );
}

function DiffView({ before, after }) {
  // Lightweight line-level diff (no external deps) — marks added/removed/unchanged lines.
  const aLines = (before || "").split("\n");
  const bLines = (after || "").split("\n");
  // Simple LCS-free diff: mark line equal if exactly equal at same index, else show before/after side by side.
  const max = Math.max(aLines.length, bLines.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const a = aLines[i];
    const b = bLines[i];
    if (a === b) {
      rows.push({ type: "eq", text: a ?? "" });
    } else {
      if (a !== undefined) rows.push({ type: "del", text: a });
      if (b !== undefined) rows.push({ type: "add", text: b });
    }
  }
  return (
    <div className="max-h-[55vh] overflow-auto rounded-md border border-border bg-background font-mono-code text-[11px] leading-snug">
      {rows.map((r, idx) => {
        const cls =
          r.type === "add"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
            : r.type === "del"
            ? "bg-red-500/10 text-red-600 dark:text-red-300 line-through opacity-80"
            : "text-muted-foreground";
        const sign = r.type === "add" ? "+" : r.type === "del" ? "-" : " ";
        return (
          <div key={idx} className={`flex gap-3 px-3 py-0.5 ${cls}`}>
            <span className="select-none w-4 shrink-0 text-center">{sign}</span>
            <span className="whitespace-pre-wrap break-all">{r.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PatchPreviewDialog({
  open,
  onOpenChange,
  patch,
  applying,
  rejecting,
  onApply,
  onReject,
}) {
  const [diffFile, setDiffFile] = useState(null);

  if (!patch) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Loading patch…</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF4400]" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (patch.status === "planning") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="patch-planning-dialog">
          <DialogHeader>
            <DialogTitle>Planning code changes…</DialogTitle>
            <DialogDescription>
              "{patch.instruction}"
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF4400]" />
            <p className="text-xs text-muted-foreground">
              OmniVibe is reading your codebase and drafting a patch. This usually takes 30–90 seconds.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (patch.status === "failed") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" data-testid="patch-failed-dialog">
          <DialogHeader>
            <DialogTitle className="text-red-500">Patch failed</DialogTitle>
            <DialogDescription>{patch.error || "AI could not draft this change."}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const creates = patch.files_to_create || [];
  const updates = patch.files_to_update || [];
  const deletes = patch.files_to_delete || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl" data-testid="patch-preview-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg font-bold">{patch.summary}</DialogTitle>
          <DialogDescription>{patch.explanation}</DialogDescription>
        </DialogHeader>

        {diffFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <code className="font-mono-code text-xs">{diffFile.path}</code>
              </div>
              <button
                onClick={() => setDiffFile(null)}
                className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-accent"
              >
                <RotateCcw className="mr-1 inline h-3 w-3" /> Back to summary
              </button>
            </div>
            <DiffView before={diffFile.before} after={diffFile.content} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                +{creates.length} create
              </span>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-600 dark:text-amber-400">
                ~{updates.length} update
              </span>
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-500">−{deletes.length} delete</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                impact: {patch.build_impact || "neutral"}
              </span>
            </div>

            {creates.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Files to create
                </p>
                <div className="space-y-1.5">
                  {creates.map((f) => (
                    <FileRow key={f.path} icon={Plus} color="text-emerald-500" file={f} onSelect={setDiffFile} />
                  ))}
                </div>
              </div>
            )}
            {updates.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Files to update
                </p>
                <div className="space-y-1.5">
                  {updates.map((f) => (
                    <FileRow key={f.path} icon={Pencil} color="text-amber-500" file={f} onSelect={setDiffFile} />
                  ))}
                </div>
              </div>
            )}
            {deletes.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Files to delete
                </p>
                <div className="space-y-1.5">
                  {deletes.map((f) => (
                    <FileRow key={f.path} icon={Minus} color="text-red-500" file={f} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {patch.status === "pending" && (
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <button
              onClick={onReject}
              disabled={applying || rejecting}
              data-testid="patch-reject-button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50"
            >
              {rejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Reject
            </button>
            <button
              onClick={onApply}
              disabled={applying || rejecting}
              data-testid="patch-apply-button"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF4400] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E63D00] disabled:opacity-50"
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Apply patch
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
