import { useState } from "react";
import { ChevronRight, FileCode, Folder, FolderOpen, Plus, Trash2 } from "lucide-react";

function langDot(language) {
  const map = {
    javascript: "bg-yellow-400",
    typescript: "bg-sky-400",
    python: "bg-emerald-400",
    json: "bg-orange-400",
    html: "bg-rose-400",
    css: "bg-purple-400",
    markdown: "bg-zinc-400",
  };
  return map[language] || "bg-zinc-500";
}

function flattenTree(nodes, expanded, parentVisible = true, depth = 0, out = []) {
  for (const node of nodes) {
    const visible = parentVisible;
    out.push({ ...node, depth, visible });
    if (node.type === "folder") {
      const isOpen = expanded.has(node.path);
      flattenTree(node.children || [], expanded, visible && isOpen, depth + 1, out);
    }
  }
  return out;
}

export default function FileTree({ tree, activePath, onSelect, onDelete, onAddInside }) {
  const [expanded, setExpanded] = useState(() => {
    // Default: expand top-level folders only
    const s = new Set();
    (tree || []).forEach((n) => {
      if (n.type === "folder") s.add(n.path);
    });
    return s;
  });

  const toggle = (path) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (!tree || tree.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-muted-foreground/70">No files yet.</p>;
  }

  const flat = flattenTree(tree, expanded);

  return (
    <div className="py-1" data-testid="file-tree">
      {flat.map((node) => {
        if (!node.visible) return null;
        const padding = { paddingLeft: `${node.depth * 12 + 8}px` };
        if (node.type === "folder") {
          const isOpen = expanded.has(node.path);
          return (
            <button
              key={node.path}
              onClick={() => toggle(node.path)}
              className="group flex w-full items-center gap-1 rounded py-1 text-xs text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              style={padding}
              data-testid={`file-tree-folder-${node.path}`}
            >
              <ChevronRight
                className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                strokeWidth={2}
              />
              {isOpen ? (
                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#FF4400]/80" strokeWidth={1.5} />
              ) : (
                <Folder className="h-3.5 w-3.5 shrink-0 text-[#FF4400]/80" strokeWidth={1.5} />
              )}
              <span className="truncate font-medium">{node.name}</span>
              {onAddInside && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddInside(node.path);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      onAddInside(node.path);
                    }
                  }}
                  className="ml-auto cursor-pointer rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100"
                  title="Add file in folder"
                  data-testid={`file-tree-add-in-${node.path}`}
                >
                  <Plus className="h-3 w-3" strokeWidth={2} />
                </span>
              )}
            </button>
          );
        }
        const isActive = activePath === node.path;
        return (
          <button
            key={node.path}
            onClick={() => onSelect(node.path)}
            data-testid={`file-tree-file-${node.path}`}
            className={`group flex w-full items-center gap-1.5 rounded py-1 text-xs transition-colors ${
              isActive
                ? "bg-[#FF4400]/12 text-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
            style={padding}
          >
            <span className="ml-3 inline-block h-3" />
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${langDot(node.language)}`} />
            <FileCode className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{node.name}</span>
            {onDelete && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(node.path);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(node.path);
                  }
                }}
                className="ml-auto cursor-pointer rounded p-0.5 opacity-0 hover:bg-red-500/15 hover:text-red-500 group-hover:opacity-100"
                title="Delete file"
                data-testid={`file-tree-delete-${node.path}`}
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
