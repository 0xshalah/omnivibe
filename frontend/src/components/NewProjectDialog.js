import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { PROJECT_TYPES } from "@/lib/labels";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewProjectDialog({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    idea: "",
    target_users: "",
    project_type: "Web App",
    description: "",
  });
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.idea.trim()) {
      toast.error("Project title and app idea are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("/projects", form);
      onOpenChange(false);
      navigate(`/project/${res.data.project_id}${autoGenerate ? "?generate=1" : ""}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="new-project-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold">New project</DialogTitle>
          <DialogDescription>
            Describe your app idea — OmniVibe will turn it into a structured build blueprint.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-title">Project title *</Label>
            <Input
              id="np-title"
              data-testid="new-project-title-input"
              placeholder="e.g. FitTrack"
              value={form.title}
              onChange={set("title")}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-idea">App idea *</Label>
            <Textarea
              id="np-idea"
              data-testid="new-project-idea-input"
              placeholder="e.g. A SaaS dashboard for tracking gym workouts with AI-generated weekly plans…"
              rows={4}
              value={form.idea}
              onChange={set("idea")}
              maxLength={5000}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Project type</Label>
              <Select
                value={form.project_type}
                onValueChange={(v) => setForm((f) => ({ ...f, project_type: v }))}
              >
                <SelectTrigger data-testid="new-project-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-users">Target users</Label>
              <Input
                id="np-users"
                data-testid="new-project-users-input"
                placeholder="e.g. Gym-goers, coaches"
                value={form.target_users}
                onChange={set("target_users")}
                maxLength={1000}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="np-desc">Short description</Label>
            <Textarea
              id="np-desc"
              data-testid="new-project-description-input"
              placeholder="Optional one-liner about the project"
              rows={2}
              value={form.description}
              onChange={set("description")}
              maxLength={2000}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <Checkbox
              checked={autoGenerate}
              onCheckedChange={(v) => setAutoGenerate(Boolean(v))}
              data-testid="new-project-autogenerate-checkbox"
            />
            <span className="text-sm">
              Auto-generate the full blueprint <span className="text-muted-foreground">(PRD, roadmap, screens, APIs, schema, checklists)</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={submitting}
            data-testid="new-project-submit-button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#FF4400] px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#E63D00] disabled:opacity-60 ai-glow"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" strokeWidth={1.5} />}
            {submitting ? "Creating…" : autoGenerate ? "Create & generate blueprint" : "Create project"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
