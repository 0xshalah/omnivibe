import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { FileCode, FolderPlus, Loader2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/labels";
import { BUILD_STATUS_LABELS, BUILD_STATUS_STYLES } from "@/lib/codeLabels";
import AppSidebar from "@/components/AppSidebar";
import NewProjectDialog from "@/components/NewProjectDialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function ProjectCard({ project, index, onOpen, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      onClick={() => onOpen(project.project_id)}
      data-testid={`project-card-${project.project_id}`}
      className="group cursor-pointer rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-[1px] hover:bg-accent/50"
    >
      <div className="flex items-start justify-between">
        <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{project.project_type}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
              data-testid={`project-menu-${project.project_id}`}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              className="text-red-500 focus:text-red-500"
              onClick={() => onDelete(project)}
              data-testid={`project-delete-${project.project_id}`}
            >
              <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} /> Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="mt-3 font-heading text-lg font-bold tracking-tight">{project.title}</h3>
      <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
        {project.description || project.idea}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${STATUS_STYLES[project.status] || STATUS_STYLES.draft}`}>
          {STATUS_LABELS[project.status] || project.status}
        </span>
        <span
          className={`rounded-md border px-2 py-1 text-xs font-medium ${
            BUILD_STATUS_STYLES[project.build_status] || "bg-muted text-muted-foreground border-border"
          }`}
          data-testid={`project-build-status-${project.project_id}`}
        >
          {BUILD_STATUS_LABELS[project.build_status] || "Not generated"}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5" data-testid={`project-file-count-${project.project_id}`}>
          <FileCode className="h-3.5 w-3.5" strokeWidth={1.5} />
          {project.file_count || 0} files
        </span>
        <span>{formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}</span>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "1");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api
      .get("/projects")
      .then((res) => setProjects(res.data))
      .catch(() => {
        setProjects([]);
        toast.error("Failed to load projects");
      });
  }, []);

  const openDialog = (open) => {
    setDialogOpen(open);
    if (!open && searchParams.get("new")) setSearchParams({}, { replace: true });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/projects/${deleteTarget.project_id}`);
      setProjects((ps) => ps.filter((p) => p.project_id !== deleteTarget.project_id));
      toast.success("Project deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row" data-testid="dashboard-page">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
              <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Projects</h1>
            </div>
            <button
              onClick={() => openDialog(true)}
              data-testid="new-project-button"
              className="inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              New project
            </button>
          </div>

          {projects === null ? (
            <div className="flex justify-center py-32">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF4400]" />
            </div>
          ) : projects.length === 0 ? (
            <div
              className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-border bg-card/40 px-8 py-24 text-center"
              data-testid="projects-empty-state"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#FF4400]/10">
                <FolderPlus className="h-7 w-7 text-[#FF4400]" strokeWidth={1.5} />
              </div>
              <h3 className="mt-5 font-heading text-xl font-bold">No projects yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Generate your first app and OmniVibe will turn your idea into a complete, editable codebase.
              </p>
              <button
                onClick={() => openDialog(true)}
                data-testid="empty-new-project-button"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Generate your first app
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3" data-testid="projects-grid">
              {projects.map((p, i) => (
                <ProjectCard
                  key={p.project_id}
                  project={p}
                  index={i}
                  onOpen={(id) => navigate(`/project/${id}`)}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <NewProjectDialog open={dialogOpen} onOpenChange={openDialog} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent data-testid="delete-project-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and all generated documents. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              data-testid="delete-confirm-button"
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
