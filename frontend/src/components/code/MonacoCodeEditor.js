import Editor from "@monaco-editor/react";
import { useTheme } from "@/context/ThemeContext";

const LANGUAGE_MAP = {
  javascript: "javascript",
  typescript: "typescript",
  python: "python",
  json: "json",
  html: "html",
  css: "css",
  markdown: "markdown",
  yaml: "yaml",
  shell: "shell",
  ini: "ini",
  plaintext: "plaintext",
};

export default function MonacoCodeEditor({ value, language, onChange, readOnly = false, height = "100%" }) {
  const { theme } = useTheme();
  return (
    <Editor
      value={value || ""}
      language={LANGUAGE_MAP[language] || "plaintext"}
      onChange={onChange}
      height={height}
      theme={theme === "dark" ? "vs-dark" : "vs"}
      loading={<div className="flex h-full items-center justify-center text-xs text-muted-foreground">Loading editor…</div>}
      options={{
        readOnly,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', Menlo, Consolas, monospace",
        fontLigatures: true,
        minimap: { enabled: false },
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        smoothScrolling: true,
        renderLineHighlight: "gutter",
        padding: { top: 14, bottom: 14 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        automaticLayout: true,
      }}
    />
  );
}
