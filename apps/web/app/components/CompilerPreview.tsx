"use client";

import { useMemo, useState } from "react";
import { useGraphStore } from "@repo/store";
import { compileGraph } from "@repo/compiler";
import { BackendIR } from "@repo/types";

type Tab = "ast" | "ir" | "prisma";

// Local interface to enforce the contract while the monorepo cache clears
interface ExpectedCompilationResult {
  success: boolean;
  issues: any[];
  ir: BackendIR | null;
}

export function CompilerPreview() {
  const graph = useGraphStore((state) => state.graph);
  const [activeTab, setActiveTab] = useState<Tab>("ast");

  // Force the return type to our expected interface to bypass stale monorepo types
  const compilation = useMemo<ExpectedCompilationResult>(() => {
    try {
      const result = compileGraph(graph) as ExpectedCompilationResult;
      
      if (!result) {
        throw new Error("Compiler returned undefined.");
      }
      return result;
      
    } catch (error: any) {
      console.error("COMPILER CRASH:", error);
      return {
        success: false,
        issues: [
          {
            type: "system",
            nodeId: "Execution Engine",
            message: error.message || "Unhandled compiler exception.",
            severity: "error",
          }
        ],
        ir: null,
      };
    }
  }, [graph]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#1e1e1e", color: "#d4d4d4", fontFamily: "monospace" }}>
      
      <div style={{ display: "flex", borderBottom: "1px solid #333", background: "#252526" }}>
        <button 
          onClick={() => setActiveTab("ast")}
          style={{ padding: "0.75rem 1.5rem", background: activeTab === "ast" ? "#1e1e1e" : "transparent", border: "none", borderTop: activeTab === "ast" ? "2px solid #007acc" : "2px solid transparent", color: activeTab === "ast" ? "#fff" : "#858585", cursor: "pointer", fontWeight: activeTab === "ast" ? "bold" : "normal" }}
        >
          1. Architecture Graph (AST)
        </button>
        <button 
          onClick={() => setActiveTab("ir")}
          style={{ padding: "0.75rem 1.5rem", background: activeTab === "ir" ? "#1e1e1e" : "transparent", border: "none", borderTop: activeTab === "ir" ? "2px solid #007acc" : "2px solid transparent", color: activeTab === "ir" ? "#fff" : "#858585", cursor: "pointer", fontWeight: activeTab === "ir" ? "bold" : "normal" }}
        >
          2. Backend IR
        </button>
        <button 
          onClick={() => setActiveTab("prisma")}
          style={{ padding: "0.75rem 1.5rem", background: activeTab === "prisma" ? "#1e1e1e" : "transparent", border: "none", borderTop: activeTab === "prisma" ? "2px solid #007acc" : "2px solid transparent", color: activeTab === "prisma" ? "#fff" : "#858585", cursor: "pointer", fontWeight: activeTab === "prisma" ? "bold" : "normal" }}
        >
          3. schema.prisma
        </button>
      </div>

      {compilation.issues && compilation.issues.length > 0 && (
        <div style={{ background: "#2a1215", borderBottom: "1px solid #f43f5e", padding: "1rem" }}>
          <h3 style={{ color: "#f43f5e", fontSize: "0.875rem", fontWeight: "bold", margin: "0 0 0.5rem 0", textTransform: "uppercase" }}>
            Compiler Diagnostics ({compilation.issues.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1rem", color: "#fecdd3", fontSize: "0.875rem" }}>
            {compilation.issues.map((issue: any, idx: number) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>
                <strong>[{issue.type}]</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
        {activeTab === "ast" && (
          <pre style={{ margin: 0, color: "#9cdcfe", fontSize: "0.875rem" }}>
            <code>{JSON.stringify(graph, null, 2)}</code>
          </pre>
        )}

        {activeTab === "ir" && (
          <div>
            {!compilation.success ? (
              <div style={{ color: "#f43f5e", padding: "1rem", border: "1px dashed #f43f5e", borderRadius: "4px" }}>
                Compilation halted due to fatal AST errors. Resolve diagnostics to generate IR.
              </div>
            ) : (
              <pre style={{ margin: 0, color: "#4ec9b0", fontSize: "0.875rem" }}>
                <code>{JSON.stringify(compilation.ir, null, 2)}</code>
              </pre>
            )}
          </div>
        )}

        {activeTab === "prisma" && (
          <div style={{ color: "#ce9178", padding: "1rem", border: "1px dashed #555", borderRadius: "4px", fontSize: "0.875rem" }}>
            // Waiting for Developer A's Plugin Registry implementation...
          </div>
        )}
      </div>
    </div>
  );
}