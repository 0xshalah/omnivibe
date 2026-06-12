export const GEN_LABELS = {
  prd: "PRD",
  features: "Feature roadmap",
  screens: "Screen plan",
  apis: "API plan",
  schemas: "Database schema",
  testing: "Testing checklist",
  deployment: "Deployment checklist",
  build_prompt: "Build prompt",
};

export const STATUS_LABELS = {
  draft: "Draft",
  planning: "Planning",
  building: "Building",
  ready: "Ready",
  shipped: "Shipped",
};

export const STATUS_STYLES = {
  draft: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400",
  planning: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  building: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  ready: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  shipped: "bg-[#FF4400]/15 text-[#FF4400]",
};

export const PRIORITY_STYLES = {
  P0: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  P1: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  P2: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/30",
};

export const PROJECT_TYPES = [
  "Web App",
  "SaaS Dashboard",
  "Mobile Web App",
  "E-commerce",
  "Internal Tool",
  "AI App",
  "API Service",
  "Portfolio / Landing",
  "Other",
];

export const FEATURE_COLUMNS = [
  { key: "backlog", label: "Backlog" },
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In Progress" },
  { key: "needs_review", label: "Needs Review" },
  { key: "done", label: "Done" },
];
