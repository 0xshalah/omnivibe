import { Database } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function SchemaTab({ schemas, generating, onGenerate }) {
  if (schemas.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="No database schema yet"
        description="Generate MongoDB collection drafts — fields, data types, required flags, descriptions and example values for every collection."
        actionLabel="Generate MongoDB schema"
        onAction={onGenerate}
        busy={generating}
        testId="schema-empty-state"
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 animate-fade-up" data-testid="schema-tab">
      {schemas.map((s) => (
        <div key={s.schema_id} className="rounded-xl border border-border bg-card" data-testid={`schema-card-${s.schema_id}`}>
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Database className="h-4 w-4 text-[#FF4400]" strokeWidth={1.5} />
              <code className="font-mono text-base font-semibold">{s.collection_name}</code>
            </div>
            {s.description && <p className="mt-1.5 text-sm text-muted-foreground">{s.description}</p>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-2.5 font-medium">Field</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Required</th>
                  <th className="px-4 py-2.5 font-medium">Description</th>
                  <th className="px-6 py-2.5 font-medium">Example</th>
                </tr>
              </thead>
              <tbody>
                {s.fields.map((f, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-6 py-2.5">
                      <code className="font-mono text-xs font-semibold">{f.name}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {f.type}
                      </code>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs ${f.required ? "text-[#FF4400]" : "text-muted-foreground"}`}>
                        {f.required ? "Required" : "Optional"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{f.description}</td>
                    <td className="px-6 py-2.5">
                      <code className="font-mono text-xs text-muted-foreground">{f.example}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
