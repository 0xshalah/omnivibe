import { useEffect, useRef, useState } from "react";
import { ArrowUp, Eye, History, Loader2, MessageSquare, RotateCcw, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/api";
import PatchPreviewDialog from "@/components/code/PatchPreviewDialog";
import { PATCH_STATUS_LABELS, PATCH_STATUS_STYLES } from "@/lib/codeLabels";

const SUGGESTIONS = [
  "Add a settings page with profile and preferences",
  "Add search and filtering to the dashboard",
  "Make the landing page more premium and modern",
  "Add admin role with admin-only routes",
  "Add user authentication with login & register pages",
  "Add CRUD endpoints for a new resource",
];

function MessageBubble({ msg, onOpenPatch }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? "bg-[#FF4400] text-white"
            : msg.meta?.error
            ? "border border-red-500/30 bg-red-500/10 text-red-500"
            : "border border-border bg-card text-foreground"
        }`}
        data-testid={`chat-message-${msg.role}`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        {msg.meta?.patch_id && (
          <button
            onClick={() => onOpenPatch(msg.meta.patch_id)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background/70 px-2 py-1 text-[11px] text-foreground hover:bg-background"
            data-testid={`open-patch-${msg.meta.patch_id}`}
          >
            <Eye className="h-3 w-3" strokeWidth={1.5} />
            View patch
          </button>
        )}
      </div>
    </div>
  );
}

export default function AICodingChat({ projectId, hasCode, onCodebaseChanged, onShowPatch, refreshSignal }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [patches, setPatches] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activePatch, setActivePatch] = useState(null);
  const [patchLoading, setPatchLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const scrollRef = useRef(null);

  const refresh = async () => {
    try {
      const [chatRes, patchRes] = await Promise.all([
        api.get(`/projects/${projectId}/chat`),
        api.get(`/projects/${projectId}/patches`),
      ]);
      setMessages(chatRes.data || []);
      setPatches(patchRes.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [projectId, refreshSignal]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const openPatch = async (patchId) => {
    setActivePatch(null);
    setPatchLoading(true);
    onShowPatch?.(true);
    try {
      // If patch is still planning, poll until it transitions to pending/failed
      for (let i = 0; i < 30; i++) {
        const res = await api.get(`/projects/${projectId}/patches/${patchId}`);
        const p = res.data;
        if (!p) throw new Error("not found");
        if (p.status === "planning") {
          setActivePatch(p);
          await new Promise((r) => setTimeout(r, 4000));
          continue;
        }
        setActivePatch(p);
        if (p.status === "failed") {
          toast.error(p.error || "AI failed to plan changes");
        }
        await refresh();
        return;
      }
      toast.warning("Planning is taking longer than usual. Try again.");
    } catch {
      toast.error("Failed to load patch");
      onShowPatch?.(false);
    } finally {
      setPatchLoading(false);
    }
  };

  const handleSend = async (text) => {
    const instruction = (text || input).trim();
    if (!instruction || sending) return;
    if (!hasCode) {
      toast.error("Generate the initial codebase first");
      return;
    }
    setInput("");
    setSending(true);
    // Optimistically add the user message
    setMessages((m) => [
      ...m,
      {
        message_id: `tmp-${Date.now()}`,
        role: "user",
        content: instruction,
        created_at: new Date().toISOString(),
      },
    ]);
    try {
      const res = await api.post(`/projects/${projectId}/patch`, { instruction });
      await refresh();
      // Auto-open the patch preview (will poll until ready)
      await openPatch(res.data.patch_id);
    } catch (e) {
      toast.error(e.response?.data?.detail || "AI failed to plan changes");
      await refresh();
    } finally {
      setSending(false);
    }
  };

  const handleApply = async () => {
    if (!activePatch) return;
    setApplying(true);
    try {
      const res = await api.post(`/projects/${projectId}/patches/${activePatch.patch_id}/apply`);
      toast.success("Patch applied");
      setActivePatch(res.data);
      onShowPatch?.(false);
      await refresh();
      onCodebaseChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to apply patch");
    } finally {
      setApplying(false);
    }
  };

  const handleReject = async () => {
    if (!activePatch) return;
    setRejecting(true);
    try {
      await api.post(`/projects/${projectId}/patches/${activePatch.patch_id}/reject`);
      toast.success("Patch rejected");
      onShowPatch?.(false);
      setActivePatch(null);
      await refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to reject patch");
    } finally {
      setRejecting(false);
    }
  };

  const handleRollback = async (patchId) => {
    setRollingBack(true);
    try {
      await api.post(`/projects/${projectId}/patches/${patchId}/rollback`);
      toast.success("Patch rolled back");
      await refresh();
      onCodebaseChanged?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Rollback failed");
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="flex h-full min-h-[560px] flex-col rounded-lg border border-border bg-card" data-testid="ai-coding-chat">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-[#FF4400]" strokeWidth={1.5} />
          <span className="text-sm font-medium">AI Code Builder</span>
          <span className="text-xs text-muted-foreground">· GPT-5.5</span>
        </div>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          data-testid="chat-history-toggle"
        >
          <History className="h-3 w-3" strokeWidth={1.5} />
          {showHistory ? "Hide history" : `History (${patches.length})`}
        </button>
      </div>

      {showHistory && (
        <div className="max-h-[180px] overflow-y-auto border-b border-border bg-background/40">
          {patches.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No patches yet.</p>
          ) : (
            patches.map((p) => (
              <div
                key={p.patch_id}
                className="flex items-center gap-3 border-b border-border/60 px-4 py-2 last:border-0"
                data-testid={`patch-history-${p.patch_id}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-foreground">{p.summary}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                  </p>
                </div>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    PATCH_STATUS_STYLES[p.status] || "bg-muted text-muted-foreground"
                  }`}
                >
                  {PATCH_STATUS_LABELS[p.status] || p.status}
                </span>
                <button
                  onClick={() => openPatch(p.patch_id)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="View"
                >
                  <Eye className="h-3 w-3" strokeWidth={1.5} />
                </button>
                {p.status === "applied" && (
                  <button
                    onClick={() => handleRollback(p.patch_id)}
                    disabled={rollingBack}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    title="Roll back"
                    data-testid={`rollback-${p.patch_id}`}
                  >
                    {rollingBack ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" strokeWidth={1.5} />}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#FF4400]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background/40 px-4 py-4">
              <p className="text-sm font-medium">Edit your app with natural language</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask OmniVibe to modify files, add features, fix bugs or refactor. Preview every change before
                applying.
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Try
              </p>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    disabled={!hasCode || sending}
                    className="flex w-full items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                    data-testid="chat-suggestion"
                  >
                    <Sparkles className="h-3 w-3 shrink-0 text-[#FF4400]" strokeWidth={1.5} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.message_id} msg={m} onOpenPatch={openPatch} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-[#FF4400]" />
            Planning code changes…
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={hasCode ? "Edit with AI…  (Enter to send)" : "Generate the codebase first"}
            rows={2}
            disabled={!hasCode || sending}
            data-testid="chat-input"
            className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-[#FF4400] disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || sending || !hasCode}
            data-testid="chat-send"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#FF4400] text-white hover:bg-[#E63D00] disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
          </button>
        </div>
      </div>

      <PatchPreviewDialog
        open={!!activePatch || patchLoading}
        onOpenChange={(o) => {
          if (!o) {
            setActivePatch(null);
            onShowPatch?.(false);
          }
        }}
        patch={activePatch}
        applying={applying}
        rejecting={rejecting}
        onApply={handleApply}
        onReject={handleReject}
      />
    </div>
  );
}
