import { useState } from "react";
import { Check, Copy, Download, Loader2, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export default function BuildPromptTab({ buildPrompt, generating, onGenerate }) {
  const [copied, setCopied] = useState(false);

  if (!buildPrompt) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No build prompt yet"
        description="Generate the final Emergent-ready build prompt — one polished prompt with your app's features, screens, database collections, API routes, auth, UI style and testing expectations. Paste it into Emergent and build."
        actionLabel="Generate build prompt"
        onAction={onGenerate}
        busy={generating}
        testId="prompt-empty-state"
      />
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildPrompt.content_markdown);
      setCopied(true);
      toast.success("Build prompt copied — paste it into Emergent");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([buildPrompt.content_markdown], { type: "text/markdown" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "emergent-build-prompt.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-up" data-testid="build-prompt-tab">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Paste this prompt into <span className="font-medium text-foreground">Emergent</span> to build your app.
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            data-testid="prompt-regenerate-button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
            Regenerate
          </button>
          <button
            onClick={handleDownload}
            data-testid="prompt-download-button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
            Download .md
          </button>
          <button
            onClick={handleCopy}
            data-testid="prompt-copy-button"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#FF4400] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </div>
      </div>

      {generating && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#FF4400]/30 bg-[#FF4400]/5 px-4 py-3 text-sm text-[#FF4400]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ai-pulse">Assembling your build prompt from the full blueprint…</span>
        </div>
      )}

      <div className="rounded-xl border border-[#FF4400]/25 bg-card" data-testid="prompt-content">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <span className="flex items-center gap-2 text-xs font-medium text-[#FF4400]">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            emergent-build-prompt.md
          </span>
          <span className="text-xs text-muted-foreground">
            {buildPrompt.content_markdown.split(/\s+/).length.toLocaleString()} words
          </span>
        </div>
        <pre className="max-h-[65vh] overflow-y-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed">
          {buildPrompt.content_markdown}
        </pre>
      </div>
    </div>
  );
}
