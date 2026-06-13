import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileCode,
  FilePlus,
  Loader2,
  Save,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import api from "@/lib/api";
import FileTree from "@/components/code/FileTree";
import MonacoCodeEditor from "@/components/code/MonacoCodeEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function detectLang(path) {
  const p = (path || "").toLowerCase();
  if (p.endsWith(".jsx") || p.endsWith(".tsx") || p.endsWith(".js")) return "javascript";
  if (p.endsWith(".ts")) return "typescript";
  if (p.endsWith(".py")) return "python";
  if (p.endsWith(".json")) return "json";
  if (p.endsWith(".html")) return "html";
  if (p.endsWith(".css")) return "css";
  if (p.endsWith(".md")) return "markdown";
  if (p.endsWith(".yml") || p.endsWith(".yaml")) return "yaml";
  return "plaintext";
}

function EmptyState({ onGenerate, generating }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center" data-testid="code-empty-state">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF4400]/10">
        <Zap className="h-7 w-7 text-[#FF4400]" strokeWidth={1.5} />
      </div>
      <h3 className="mt-5 font-heading text-xl font-bold tracking-tight">No codebase yet</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Generate a complete React + FastAPI + MongoDB codebase from your app idea. OmniVibe creates
        every file: pages, components, API routes, schemas and README.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        data-testid="generate-codebase-button"
        className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] disabled:opacity-60 ai-glow"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.5} />}
        {generating ? "Generating codebase…" : "Generate Codebase"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground/70">Usually takes 60–120 seconds.</p>
    </div>
  );
}

export default function CodeTab({ projectId, tree, files, generating, onGenerate, onReload }) {
  const allFiles = files || [];
  const [activePath, setActivePath] = useState(null);
  const [openFile, setOpenFile] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [editingValue, setEditingValue] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newFileDialog, setNewFileDialog] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");

  // Pick the first interesting file when codebase loads
  useEffect(() => {
    if (!activePath && allFiles.length > 0) {
      const preferred = [
        "frontend/src/App.jsx",
        "backend/server.py",
        "README.md",
      ];
      const found = preferred.find((p) => allFiles.some((f) => f.file_path === p));
      setActivePath(found || allFiles[0].file_path);
    }
  }, [allFiles, activePath]);

  // Fetch content when active path changes
  useEffect(() => {
    if (!activePath) return;
    setLoadingFile(true);
    setDirty(false);
    api
      .get(`/projects/${projectId}/files/content`, { params: { path: activePath } })
      .then((res) => {
        setOpenFile(res.data);
        setEditingValue(res.data.content || "");
      })
      .catch(() => {
        toast.error("Failed to load file");
        setOpenFile(null);
      })
      .finally(() => setLoadingFile(false));
  }, [activePath, projectId]);

  const handleEdit = (val) => {
    setEditingValue(val || "");
    setDirty(true);
  };

  const handleSave = async () => {
    if (!openFile) return;
    setSaving(true);
    try {
      const res = await api.put(`/projects/${projectId}/files`, {
        path: openFile.file_path,
        content: editingValue,
      });
      setOpenFile(res.data);
      setDirty(false);
      toast.success("Saved");
      onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${projectId}/files`, { params: { path: deleteTarget } });
      toast.success("File deleted");
      if (activePath === deleteTarget) {
        setActivePath(null);
        setOpenFile(null);
      }
      setDeleteTarget(null);
      onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to delete");
    }
  };

  const handleCreate = async () => {
    const path = newFilePath.trim();
    if (!path) return;
    try {
      const res = await api.put(`/projects/${projectId}/files`, { path, content: "" });
      setNewFileDialog(false);
      setNewFilePath("");
      setActivePath(res.data.file_path);
      onReload?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create file");
    }
  };

  const openFolder = useMemo(() => activePath?.split("/").slice(0, -1).join("/"), [activePath]);

  if (allFiles.length === 0) {
    return <EmptyState onGenerate={onGenerate} generating={generating} />;
  }

  const language = openFile?.language || detectLang(activePath);

  return (
    <div className="flex h-full min-h-[560px] gap-3" data-testid="code-tab">
      {/* File explorer */}
      <div className="flex w-64 shrink-0 flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Explorer
          </span>
          <button
            onClick={() => {
              setNewFilePath((openFolder ? openFolder + "/" : "") + "");
              setNewFileDialog(true);
            }}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="New file"
            data-testid="new-file-button"
          >
            <FilePlus className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-3 pt-1.5">
          <FileTree
            tree={tree}
            activePath={activePath}
            onSelect={setActivePath}
            onDelete={setDeleteTarget}
            onAddInside={(folder) => {
              setNewFilePath(folder + "/");
              setNewFileDialog(true);
            }}
          />
        </div>
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          {allFiles.length} files
        </div>
      </div>

      {/* Editor */}
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="truncate font-mono-code text-xs text-foreground" data-testid="editor-path">
              {activePath || "—"}
            </span>
            {dirty && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              data-testid="editor-save-button"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" strokeWidth={1.5} />}
              Save
            </button>
            <button
              onClick={onGenerate}
              disabled={generating}
              data-testid="regen-codebase-button"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#FF4400]/10 px-2.5 py-1 text-xs font-medium text-[#FF4400] transition-colors hover:bg-[#FF4400]/20 disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" strokeWidth={1.5} />}
              {generating ? "Generating…" : "Regenerate"}
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {loadingFile ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[#FF4400]" />
            </div>
          ) : openFile ? (
            <MonacoCodeEditor value={editingValue} language={language} onChange={handleEdit} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Select a file
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-file-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{deleteTarget}</code> will be removed
              from the codebase. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="delete-file-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
        <DialogContent className="sm:max-w-md" data-testid="new-file-dialog">
          <DialogHeader>
            <DialogTitle>New file</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="frontend/src/pages/NewPage.jsx"
              data-testid="new-file-path-input"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Full path including folders.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setNewFileDialog(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
              >
                <X className="mr-1 inline h-3 w-3" />
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newFilePath.trim()}
                data-testid="new-file-confirm"
                className="rounded-md bg-[#FF4400] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E63D00] disabled:opacity-50"
              >
                Create file
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
