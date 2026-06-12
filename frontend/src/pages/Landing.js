import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCheck,
  Database,
  FileText,
  KanbanSquare,
  Monitor,
  Sparkles,
  Zap,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const HERO_IMG =
  "https://images.pexels.com/photos/14963655/pexels-photo-14963655.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const FEATURES = [
  {
    icon: FileText,
    title: "AI PRD Generator",
    desc: "Turn a rough idea into a complete, editable PRD — goals, user stories, requirements, acceptance criteria.",
  },
  {
    icon: KanbanSquare,
    title: "Feature Roadmap Board",
    desc: "AI-generated build modules on a Kanban board with priorities, dependencies, and acceptance criteria.",
  },
  {
    icon: Monitor,
    title: "Screen Planner",
    desc: "Screen-by-screen plans with components, user actions, and empty, error, and loading states.",
  },
  {
    icon: Database,
    title: "API & Schema Planner",
    desc: "FastAPI endpoint plans and MongoDB collection drafts with fields, types, and example values.",
  },
  {
    icon: CheckCheck,
    title: "Testing & Deployment Checklists",
    desc: "Practical, app-specific checklists so nothing breaks when you ship.",
  },
  {
    icon: Sparkles,
    title: "Emergent-Ready Build Prompt",
    desc: "One polished prompt with everything an AI builder needs — paste it into Emergent and build.",
  },
];

const STEPS = [
  { n: "01", title: "Describe your idea", desc: "A sentence or a paragraph — rough is fine." },
  { n: "02", title: "Generate the blueprint", desc: "PRD, roadmap, screens, APIs, schema, and checklists in minutes." },
  { n: "03", title: "Ship with Emergent", desc: "Export docs or paste the build prompt into Emergent and watch it build." },
];

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    if (user) {
      navigate("/dashboard");
      return;
    }
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100" data-testid="landing-page">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#09090B]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4400]">
              <Zap size={18} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight">OmniVibe</span>
          </div>
          <button
            onClick={handleLogin}
            data-testid="nav-login-button"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            {user ? "Open dashboard" : "Sign in with Google"}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <img src={HERO_IMG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/70 to-[#09090B]" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-[#FF4400]">
              AI build orchestration for vibe coders
            </p>
            <h1 className="mt-5 font-heading text-4xl font-bold leading-none tracking-tight sm:text-5xl lg:text-6xl">
              From rough idea to
              <span className="text-[#FF4400]"> build-ready blueprint.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-zinc-400 md:text-lg">
              OmniVibe turns messy app ideas into structured PRDs, feature roadmaps, screen plans, API specs,
              database schemas, checklists — and a final Emergent-ready build prompt.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                onClick={handleLogin}
                data-testid="hero-login-button"
                className="inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
              >
                {user ? "Open dashboard" : "Start planning free"}
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </button>
              <a
                href="#features"
                className="rounded-md border border-white/15 px-6 py-3 text-sm text-zinc-300 transition-colors hover:bg-white/5"
              >
                See what it generates
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">What you get</p>
        <h2 className="mt-3 max-w-xl font-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          A complete planning layer for AI-built apps
        </h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              className="rounded-xl border border-white/10 bg-[#18181B] p-6 transition-colors hover:bg-[#1f1f23]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF4400]/10">
                <f.icon className="h-5 w-5 text-[#FF4400]" strokeWidth={1.5} />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/5 bg-[#0c0c0f]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-500">How it works</p>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-sm text-[#FF4400]">{s.n}</span>
                <h3 className="mt-3 font-heading text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-16 rounded-xl border border-white/10 bg-[#18181B] p-8 text-center sm:p-12">
            <h3 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              Stop prompting blind. Plan first.
            </h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">
              Sign in with Google and generate your first project blueprint in minutes.
            </p>
            <button
              onClick={handleLogin}
              data-testid="cta-login-button"
              className="mt-7 inline-flex items-center gap-2 rounded-md bg-[#FF4400] px-6 py-3 text-sm font-medium text-white transition-all hover:bg-[#E63D00] ai-glow"
            >
              {user ? "Open dashboard" : "Get started — it's free"}
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8">
        <p className="text-center text-xs text-zinc-600">
          OmniVibe — AI project planning for vibe-coded apps. Built on Emergent.
        </p>
      </footer>
    </div>
  );
}
