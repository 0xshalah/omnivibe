import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Copy, Download, FileArchive, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function CodebaseExportTab({ project, files, buildPromptAvailable }) {
  const [downloading, setDownloading] = useState(null);
  const projectId = project?.project_id;
  const title = project?.title || "omnivibe-app";

  const downloadZip = async () => {
    if (!files || files.length === 0) {
      toast.error("Generate the codebase first");
      return;
    }
    setDownloading("zip");
    try {
      const res = await api.get(`/projects/${projectId}/codebase/export/zip`, { responseType: "blob" });
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "omnivibe-app";
      saveAs(new Blob([res.data], { type: "application/zip" }), `${slug}.zip`);
      toast.success("ZIP downloaded");
    } catch (e) {
      // Fallback: build ZIP locally from cached files (only metadata; we need content)
      try {
        const filesRes = await api.get(`/projects/${projectId}/files`);
        const zip = new JSZip();
        for (const f of filesRes.data) {
          const r = await api.get(`/projects/${projectId}/files/content`, { params: { path: f.file_path } });
          zip.file(`${title}/${f.file_path}`, r.data.content || "");
        }
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, `${title}.zip`);
        toast.success("ZIP downloaded (client-built)");
      } catch {
        toast.error("Failed to download ZIP");
      }
    } finally {
      setDownloading(null);
    }
  };

  const downloadBundle = async () => {
    if (!files || files.length === 0) {
      toast.error("Generate the codebase first");
      return;
    }
    setDownloading("md");
    try {
      const res = await api.get(`/projects/${projectId}/codebase/export/bundle`, { responseType: "blob" });
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "omnivibe-app";
      saveAs(new Blob([res.data], { type: "text/markdown" }), `${slug}-codebase.md`);
      toast.success("Markdown bundle downloaded");
    } catch {
      toast.error("Failed to download bundle");
    } finally {
      setDownloading(null);
    }
  };

  const copyFileContent = async (path) => {
    try {
      const r = await api.get(`/projects/${projectId}/files/content`, { params: { path } });
      await navigator.clipboard.writeText(r.data.content || "");
      toast.success(`Copied ${path}`);
    } catch {
      toast.error("Failed to copy file");
    }
  };

  const fileList = (files || []).slice(0, 25);

  return (
    <div className="space-y-6" data-testid="codebase-export-tab">
      <div>
        <h2 className="font-heading text-2xl font-bold tracking-tight">Export Codebase</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download the complete generated project, or copy individual files for quick paste-in.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <FileArchive className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
            <h3 className="font-semibold">ZIP archive</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Full {files?.length || 0}-file project as a single ZIP. Unzip and run locally.
          </p>
          <button
            onClick={downloadZip}
            disabled={downloading === "zip" || !files?.length}
            data-testid="export-zip-button"
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-4 py-2 text-sm font-medium text-white hover:bg-[#E63D00] disabled:opacity-50"
          >
            {downloading === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.5} />}
            Download ZIP
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
            <h3 className="font-semibold">Markdown bundle</h3>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One markdown file containing every code file fenced for sharing or AI re-prompting.
          </p>
          <button
            onClick={downloadBundle}
            disabled={downloading === "md" || !files?.length}
            data-testid="export-bundle-button"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {downloading === "md" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.5} />}
            Download .md bundle
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold">Quick-copy files</h3>
        <p className="mt-1 text-xs text-muted-foreground">Showing first 25 files. Click to copy the file content to clipboard.</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {fileList.length === 0 && <p className="text-xs text-muted-foreground">No files yet.</p>}
          {fileList.map((f) => (
            <button
              key={f.file_path}
              onClick={() => copyFileContent(f.file_path)}
              className="group flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-left text-xs hover:bg-accent"
              data-testid={`copy-${f.file_path}`}
            >
              <Copy className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground" strokeWidth={1.5} />
              <span className="truncate font-mono-code">{f.file_path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
