"use client";

import { useMemo } from "react";
import { useGraphStore } from "@repo/store";
import { validateGraph } from "@repo/validation";

export function GraphDebugger() {
  const graph = useGraphStore((state) => state.graph);
  const addEntity = useGraphStore((state) => state.addEntity);

  // Derive graph diagnostics synchronously
  const issues = useMemo(() => validateGraph(graph), [graph]);

  const handleTestMutation = () => {
    try {
      addEntity({
        name: "TestUser",
        primaryKey: "id",
        fields: [
          { name: "id", type: "string", required: true },
          { name: "role", type: "string", required: true }
        ]
      });
    } catch (e) {
      console.warn("Mutation rejected: Entity likely already exists.");
    }
  };

  return (
    <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600" }}>AST Memory State</h2>
        <button 
          onClick={handleTestMutation}
          style={{ 
            padding: "0.5rem 1rem", 
            background: "var(--foreground)", 
            color: "var(--background)", 
            border: "none", 
            borderRadius: "4px", 
            cursor: "pointer", 
            fontFamily: "inherit",
            fontWeight: "500"
          }}
        >
          Inject Test Entity
        </button>
      </div>

      {issues.length > 0 && (
        <div style={{ marginBottom: "1rem", background: "#2a1215", borderLeft: "4px solid #f43f5e", padding: "1rem", borderRadius: "0 4px 4px 0" }}>
          <h3 style={{ color: "#f43f5e", fontSize: "0.875rem", fontWeight: "bold", marginBottom: "0.5rem", textTransform: "uppercase" }}>
            Active Diagnostics ({issues.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1rem", color: "#fecdd3", fontSize: "0.875rem" }}>
            {issues.map((issue, idx) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>
                <strong>[{issue.type}]</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <pre style={{ 
        background: "#111111", 
        padding: "1.5rem", 
        borderRadius: "6px", 
        color: "#10b981", 
        overflowX: "auto", 
        fontSize: "0.875rem",
        lineHeight: "1.5",
        margin: 0
      }}>
        <code>{JSON.stringify(graph, null, 2)}</code>
      </pre>
    </div>
  );
}