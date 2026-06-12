import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Folder, LayoutDashboard, LogOut, Moon, Plus, Sun, Zap } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5" data-testid="sidebar-logo">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF4400]">
        <Zap className="h-4.5 w-4.5 text-white" size={18} strokeWidth={2} />
      </div>
      <span className="font-heading text-lg font-bold tracking-tight">OmniVibe</span>
    </Link>
  );
}

export default function AppSidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    api
      .get("/projects")
      .then((res) => setProjects(res.data))
      .catch(() => {});
  }, []);

  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-4 py-3 md:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            data-testid="mobile-theme-toggle"
          >
            <ThemeIcon className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={logout}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            data-testid="mobile-logout-button"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex" data-testid="app-sidebar">
        <div className="px-5 py-5">
          <Logo />
        </div>

        <nav className="px-3">
          <Link
            to="/dashboard"
            data-testid="sidebar-dashboard-link"
            className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
              !projectId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} />
            Dashboard
          </Link>
        </nav>

        <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
          <div className="flex items-center justify-between px-3 pb-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Projects</span>
            <button
              onClick={() => navigate("/dashboard?new=1")}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-[#FF4400]"
              data-testid="sidebar-new-project-button"
              title="New project"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto pb-4">
            {projects.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground/70">No projects yet</p>
            )}
            {projects.map((p) => (
              <Link
                key={p.project_id}
                to={`/project/${p.project_id}`}
                data-testid={`sidebar-project-${p.project_id}`}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  projectId === p.project_id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Folder className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{p.title}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-border p-3">
          <button
            onClick={toggleTheme}
            data-testid="theme-toggle"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ThemeIcon className="h-4 w-4" strokeWidth={1.5} />
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="mt-2 flex items-center gap-2.5 rounded-md px-3 py-2">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF4400]/15 text-xs font-semibold text-[#FF4400]">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium" data-testid="sidebar-user-name">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              data-testid="logout-button"
              title="Sign out"
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
