import { useMemo, useState } from "react";
import { Sandpack } from "@codesandbox/sandpack-react";
import { ArrowRight, FileCode, Layers, Loader2, Map, Monitor, RefreshCw } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

function packSandpackFiles(files) {
  // Sandpack runs frontend only. We map our project tree into Sandpack's vfs root
  // and strip the "frontend/" prefix so Vite/CRA-style entry points work.
  const result = {};
  let main = null;
  let appFile = null;
  let indexHtml = null;
  let pkg = null;

  for (const f of files) {
    const p = f.file_path;
    if (!p.startsWith("frontend/")) continue;
    const stripped = "/" + p.replace(/^frontend\//, "");
    result[stripped] = { code: f.content || "" };
    if (stripped === "/src/main.jsx" || stripped === "/src/main.js") main = stripped;
    if (stripped === "/src/App.jsx" || stripped === "/src/App.js") appFile = stripped;
    if (stripped === "/index.html") indexHtml = stripped;
    if (stripped === "/package.json") pkg = stripped;
  }

  return { result, main, appFile, indexHtml, pkg };
}

function SandpackPreview({ files }) {
  const { theme } = useTheme();
  const packed = useMemo(() => packSandpackFiles(files || []), [files]);
  const { main, appFile, indexHtml, pkg } = packed;

  const hasFrontend = Object.keys(packed.result).length > 0 && (main || appFile);

  if (!hasFrontend) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <Monitor className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.2} />
        <p className="mt-3 text-sm font-medium">Frontend not generated yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Generate the codebase to launch the live preview.
        </p>
      </div>
    );
  }

  // Clone so we don't mutate the memoized packing result
  const sandFiles = { ...packed.result };
  if (indexHtml && !sandFiles[indexHtml].code.includes("tailwindcss")) {
    sandFiles[indexHtml] = {
      code: sandFiles[indexHtml].code.replace(
        "</head>",
        '  <script src="https://cdn.tailwindcss.com"></script>\n  </head>'
      ),
    };
  } else if (!indexHtml) {
    sandFiles["/index.html"] = {
      code: `<!DOCTYPE html><html><head><title>Preview</title><script src="https://cdn.tailwindcss.com"></script></head><body><div id="root"></div><script type="module" src="${
        main || "/src/main.jsx"
      }"></script></body></html>`,
    };
  }

  let parsedPkg = null;
  try {
    parsedPkg = pkg ? JSON.parse(sandFiles[pkg].code) : null;
  } catch {
    parsedPkg = null;
  }
  const dependencies = {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    axios: "^1.7.0",
    ...(parsedPkg?.dependencies || {}),
  };

  return (
    <div className="h-full overflow-hidden rounded-lg border border-border bg-card">
      <Sandpack
        template="vite-react"
        theme={theme === "dark" ? "dark" : "light"}
        files={sandFiles}
        customSetup={{ dependencies, entry: main || "/src/main.jsx" }}
        options={{
          showNavigator: true,
          showTabs: false,
          showRefreshButton: true,
          editorHeight: 0,
          showLineNumbers: false,
          showInlineErrors: true,
          recompileMode: "delayed",
          recompileDelay: 600,
        }}
      />
    </div>
  );
}

function RouteMap({ codebase, files }) {
  const pages = codebase?.plan?.pages || [];
  const apis = codebase?.plan?.api_routes || [];
  const components = codebase?.plan?.components || [];
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="route-map">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Map className="h-3.5 w-3.5 text-[#FF4400]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold">Frontend routes</h3>
        </div>
        {pages.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No pages in plan.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pages.map((p) => (
              <li key={p.name + p.route} className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <code className="font-mono-code text-xs text-foreground">{p.route}</code>
                  <span className="text-xs text-muted-foreground">→ {p.name}</span>
                </div>
                {p.purpose && <p className="mt-1 text-[11px] text-muted-foreground">{p.purpose}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <FileCode className="h-3.5 w-3.5 text-[#FF4400]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold">Backend API routes</h3>
        </div>
        {apis.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No API routes in plan.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {apis.map((a, i) => (
              <li key={i} className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono-code text-[10px] font-semibold uppercase">
                    {a.method}
                  </span>
                  <code className="font-mono-code text-xs">{a.route}</code>
                </div>
                {a.purpose && <p className="mt-1 text-[11px] text-muted-foreground">{a.purpose}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-border bg-card p-4 lg:col-span-2">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Layers className="h-3.5 w-3.5 text-[#FF4400]" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold">Components hierarchy</h3>
        </div>
        {components.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">No components in plan.</p>
        ) : (
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {components.map((c) => (
              <div key={c.name} className="rounded-md border border-border/70 bg-background/40 px-3 py-2">
                <p className="font-mono-code text-xs font-medium">{c.name}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.purpose}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenMockups({ codebase }) {
  const pages = codebase?.plan?.pages || [];
  if (pages.length === 0) {
    return <p className="text-xs text-muted-foreground">Generate the codebase to see screen mockups.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="screen-mockups">
      {pages.map((p, idx) => (
        <div key={idx} className="rounded-lg border border-border bg-card p-3">
          <div className="aspect-[4/3] overflow-hidden rounded-md border border-border/70 bg-background">
            <div className="flex h-5 items-center gap-1 border-b border-border/70 bg-muted/50 px-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="ml-2 truncate font-mono-code text-[9px] text-muted-foreground">
                {p.route}
              </span>
            </div>
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/5 rounded bg-foreground/10" />
              <div className="h-2 w-4/5 rounded bg-foreground/5" />
              <div className="h-2 w-3/4 rounded bg-foreground/5" />
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <div className="h-8 rounded bg-[#FF4400]/15" />
                <div className="h-8 rounded bg-foreground/5" />
                <div className="h-8 rounded bg-foreground/5" />
              </div>
              <div className="mt-2 h-12 rounded bg-foreground/5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-sm font-medium">{p.name}</p>
            <p className="line-clamp-2 text-[11px] text-muted-foreground">{p.purpose}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const MODES = [
  { key: "live", label: "Live preview" },
  { key: "routes", label: "Route map" },
  { key: "mockups", label: "Screen mockups" },
];

export default function PreviewTab({ codebase, files, buildCheck, onRefresh, refreshing }) {
  const [mode, setMode] = useState("live");
  const fileCount = files?.length || 0;
  const hasFrontend = (files || []).some((f) => f.file_path.startsWith("frontend/"));

  return (
    <div className="flex h-full min-h-[560px] flex-col" data-testid="preview-tab">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              data-testid={`preview-mode-${m.key}`}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                mode === m.key ? "bg-[#FF4400] text-white" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span data-testid="preview-file-count">{fileCount} files</span>
          {buildCheck && (
            <span
              className={`rounded-full px-2 py-0.5 ${
                buildCheck.status === "deployment_ready"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : buildCheck.status === "build_ready"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                  : buildCheck.status === "needs_review"
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-red-500/15 text-red-500"
              }`}
            >
              Build: {buildCheck.status.replace("_", " ")}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 hover:bg-accent disabled:opacity-50"
            data-testid="preview-refresh"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" strokeWidth={1.5} />}
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === "live" && (
          <div className="h-[640px]">
            {hasFrontend ? (
              <SandpackPreview files={files} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 text-center">
                <Monitor className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.2} />
                <p className="mt-3 text-sm font-medium">Frontend not generated yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Once the codebase is generated, your React app will execute live in this iframe.
                </p>
              </div>
            )}
          </div>
        )}
        {mode === "routes" && (
          <div className="overflow-y-auto">
            <RouteMap codebase={codebase} files={files} />
          </div>
        )}
        {mode === "mockups" && (
          <div className="overflow-y-auto">
            <ScreenMockups codebase={codebase} />
          </div>
        )}
      </div>
    </div>
  );
}
