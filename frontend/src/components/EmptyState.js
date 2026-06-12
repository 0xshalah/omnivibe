import { Loader2 } from "lucide-react";

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction, busy, testId }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 px-8 py-20 text-center"
      data-testid={testId}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#FF4400]/10">
        <Icon className="h-7 w-7 text-[#FF4400]" strokeWidth={1.5} />
      </div>
      <h3 className="font-heading text-xl font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {onAction && (
        <button
          onClick={onAction}
          disabled={busy}
          data-testid={`${testId}-action`}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] disabled:opacity-60 ai-glow"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Generating…" : actionLabel}
        </button>
      )}
    </div>
  );
}
