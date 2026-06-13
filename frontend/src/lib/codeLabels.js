export const BUILD_STATUS_LABELS = {
  not_ready: "Not ready",
  needs_review: "Needs review",
  build_ready: "Build-ready",
  deployment_ready: "Deployment-ready",
};

export const BUILD_STATUS_STYLES = {
  not_ready: "bg-red-500/15 text-red-500 border-red-500/30",
  needs_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  build_ready: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  deployment_ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
};

export const VISUAL_STYLES = [
  "Minimal Modern",
  "Premium Dark",
  "Playful & Colorful",
  "Brutalist",
  "Glassmorphic",
  "Editorial / Magazine",
  "Apple-clean",
  "Y Combinator startup",
];

export const DEPLOYMENT_TARGETS = ["Emergent", "Vercel + Render", "Self-host", "Local only"];

export const PATCH_STATUS_LABELS = {
  planning: "Planning…",
  pending: "Pending review",
  applied: "Applied",
  rejected: "Rejected",
  rolled_back: "Rolled back",
  failed: "Failed",
};

export const PATCH_STATUS_STYLES = {
  planning: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  applied: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  rejected: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30",
  rolled_back: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  failed: "bg-red-500/15 text-red-500 border-red-500/30",
};
