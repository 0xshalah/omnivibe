import { useState } from "react";
import {
  Database,
  Download,
  FileText,
  FileType2,
  FlaskConical,
  KanbanSquare,
  Loader2,
  Network,
  Package,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

const DOCS = [
  { key: "prd", label: "Full PRD", desc: "The complete product requirements document", icon: FileText },
  { key: "features", label: "Feature roadmap", desc: "All modules with priorities, criteria and dependencies", icon: KanbanSquare },
  { key: "apis", label: "API plan", desc: "Every endpoint with request/response shapes", icon: Network },
  { key: "schemas", label: "Database schema", desc: "MongoDB collection drafts with field tables", icon: Database },
  { key: "testing", label: "Testing checklist", desc: "App-specific test plan with completion state", icon: FlaskConical },
  { key: "deployment", label: "Deployment checklist", desc: "Deployment readiness checks", icon: Rocket },
  { key: "blueprint", label: "Complete project blueprint", desc: "Everything combined into one document", icon: Package },
];

export default function ExportTab({ project, availability }) {
  const [busy, setBusy] = useState(null);

  const download = async (doc, format) => {
    const key = `${doc}-${format}`;
    setBusy(key);
    try {
      const res = await api.get(`/projects/${project.project_id}/export`, {
        params: { doc, format },
        responseType: "blob",
      });
      const ext = format === "pdf" ? "pdf" : "md";
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="(.+?)"/);
      const filename = match ? match[1] : `${doc}.${ext}`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${filename}`);
    } catch (e) {
      if (e.response?.status === 404) {
        toast.error("Nothing to export yet — generate this document first.");
      } else {
        toast.error("Export failed. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl animate-fade-up" data-testid="export-tab">
      <p className="mb-6 text-sm text-muted-foreground">
        Download your planning documents as Markdown or PDF. Exports never include API keys or private tokens.
      </p>
      <div className="space-y-2.5">
        {DOCS.map((d) => {
          const available = availability[d.key];
          return (
            <div
              key={d.key}
              data-testid={`export-row-${d.key}`}
              className={`flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card px-5 py-4 ${
                available ? "" : "opacity-50"
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF4400]/10">
                <d.icon className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {available ? d.desc : "Not generated yet"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => download(d.key, "markdown")}
                  disabled={!available || busy === `${d.key}-markdown`}
                  data-testid={`export-md-${d.key}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === `${d.key}-markdown` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  Markdown
                </button>
                <button
                  onClick={() => download(d.key, "pdf")}
                  disabled={!available || busy === `${d.key}-pdf`}
                  data-testid={`export-pdf-${d.key}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy === `${d.key}-pdf` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileType2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
