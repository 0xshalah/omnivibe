import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Eye, FileText, Loader2, PencilLine, RotateCw, Save } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function PRDTab({ prd, generating, onGenerate, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState(prd?.content_markdown || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(prd?.content_markdown || "");
  }, [prd]);

  if (!prd) {
    return (
      <EmptyState
        icon={FileText}
        title="No PRD yet"
        description="Generate a complete, editable Product Requirements Document from your app idea — executive summary, user stories, requirements, acceptance criteria and more."
        actionLabel="Generate PRD"
        onAction={() => onGenerate("generate")}
        busy={generating}
        testId="prd-empty-state"
      />
    );
  }

  const dirty = draft !== prd.content_markdown;

  const handleSave = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) setEditMode(false);
  };

  return (
    <div className="mx-auto max-w-4xl animate-fade-up" data-testid="prd-tab">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground" data-testid="prd-version">
            v{prd.version}
          </span>
          <span className="text-xs text-muted-foreground">
            {prd.content_markdown.split(/\s+/).length.toLocaleString()} words
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onGenerate("improve")}
            disabled={generating}
            data-testid="prd-regenerate-button"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
            Improve with AI
          </button>
          <button
            onClick={() => setEditMode((m) => !m)}
            data-testid="prd-edit-toggle"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent"
          >
            {editMode ? <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> : <PencilLine className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {editMode ? "Preview" : "Edit"}
          </button>
          {editMode && (
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              data-testid="prd-save-button"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF4400] px-3 py-2 text-xs font-medium text-white transition-all hover:bg-[#E63D00] disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={1.5} />}
              Save version
            </button>
          )}
        </div>
      </div>

      {generating && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[#FF4400]/30 bg-[#FF4400]/5 px-4 py-3 text-sm text-[#FF4400]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ai-pulse">AI is rewriting the PRD…</span>
        </div>
      )}

      {editMode ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          data-testid="prd-editor-textarea"
          className="min-h-[65vh] w-full resize-y rounded-xl border border-border bg-card p-5 font-mono text-sm leading-relaxed outline-none focus:border-ring"
          spellCheck={false}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8" data-testid="prd-preview">
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{prd.content_markdown}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
