"use client";

import { useMemo, useState } from "react";
import { useGraphStore } from "@repo/store";
import { compileGraph } from "@repo/compiler";
import { executeGenerators } from "@repo/plugins";
import { BackendIR } from "@repo/types";

type Tab = "ast" | "ir" | "prisma" | "nestjs";

interface ExpectedCompilationResult {
  success: boolean;
  issues: any[];
  ir: BackendIR | null;
}

export function CompilerPreview() {
  const graph = useGraphStore((state) => state.graph);
  const [activeTab, setActiveTab] = useState<Tab>("ast");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const compilation = useMemo<ExpectedCompilationResult>(() => {
    try {
      const result = compileGraph(graph) as ExpectedCompilationResult;
      if (!result) throw new Error("Compiler returned undefined.");
      return result;
    } catch (error: any) {
      return { success: false, issues: [{ type: "system", nodeId: "Execution Engine", message: error.message || "Unhandled exception.", severity: "error" }], ir: null };
    }
  }, [graph]);

  const artifacts = useMemo(() => {
    if (compilation.success && compilation.ir) {
      try {
        return executeGenerators(compilation.ir);
      } catch (err) {
        console.error("Generator Error:", err);
        return null;
      }
    }
    return null;
  }, [compilation]);

  const fileSystem = artifacts?.fileSystem || {};
  const fileKeys = Object.keys(fileSystem);
  
  // Deriving active file cleanly without triggering React render warnings
  const activeFile = (selectedFile && fileKeys.includes(selectedFile)) ? selectedFile : (fileKeys[0] || null);

  const TabButton = ({ id, label }: { id: Tab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      style={{ padding: "0.75rem 1.5rem", background: activeTab === id ? "#1e1e1e" : "transparent", border: "none", borderTop: activeTab === id ? "2px solid #007acc" : "2px solid transparent", color: activeTab === id ? "#fff" : "#858585", cursor: "pointer", fontWeight: activeTab === id ? "bold" : "normal" }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#1e1e1e", color: "#d4d4d4", fontFamily: "monospace" }}>
      
      <div style={{ display: "flex", borderBottom: "1px solid #333", background: "#252526" }}>
        <TabButton id="ast" label="1. AST" />
        <TabButton id="ir" label="2. Backend IR" />
        <TabButton id="prisma" label="3. Prisma" />
        <TabButton id="nestjs" label="4. NestJS App" />
      </div>

      {compilation.issues && compilation.issues.length > 0 && (
        <div style={{ background: "#2a1215", borderBottom: "1px solid #f43f5e", padding: "1rem" }}>
          <h3 style={{ color: "#f43f5e", fontSize: "0.875rem", fontWeight: "bold", margin: "0 0 0.5rem 0", textTransform: "uppercase" }}>
            Compiler Diagnostics ({compilation.issues.length})
          </h3>
          <ul style={{ margin: 0, paddingLeft: "1rem", color: "#fecdd3", fontSize: "0.875rem" }}>
            {compilation.issues.map((issue: any, idx: number) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}><strong>[{issue.severity.toUpperCase()}]</strong> {issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {activeTab === "ast" && (
          <pre style={{ margin: 0, padding: "1.5rem", color: "#9cdcfe", fontSize: "0.875rem", overflowY: "auto", width: "100%" }}>
            <code>{JSON.stringify(graph, null, 2)}</code>
          </pre>
        )}

        {activeTab === "ir" && (
          <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "1.5rem" }}>
            {!compilation.success ? (
              <div style={{ color: "#f43f5e", padding: "1rem", border: "1px dashed #f43f5e", borderRadius: "4px" }}>Compilation halted due to fatal AST errors.</div>
            ) : (
              <pre style={{ margin: 0, color: "#4ec9b0", fontSize: "0.875rem" }}>
                <code>{JSON.stringify(compilation.ir, null, 2)}</code>
              </pre>
            )}
          </div>
        )}

        {activeTab === "prisma" && (
          <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "1.5rem" }}>
             {!artifacts?.prisma ? (
                <div style={{ color: "#858585" }}>No Prisma schema generated. Ensure the graph contains valid entities.</div>
             ) : (
                <pre style={{ margin: 0, color: "#ce9178", fontSize: "0.875rem" }}>
                  <code>{artifacts.prisma}</code>
                </pre>
             )}
          </div>
        )}

        {activeTab === "nestjs" && (
          <div style={{ display: "flex", width: "100%", height: "100%" }}>
            {fileKeys.length === 0 ? (
              <div style={{ padding: "1.5rem", color: "#858585" }}>No NestJS files generated. Valid Backend IR required.</div>
            ) : (
              <>
                <div style={{ width: "250px", borderRight: "1px solid #333", background: "#252526", overflowY: "auto", padding: "1rem 0" }}>
                  <div style={{ padding: "0 1rem", marginBottom: "0.5rem", color: "#858585", fontSize: "0.75rem", textTransform: "uppercase" }}>Virtual Filesystem</div>
                  {fileKeys.map(key => (
                    <div 
                      key={key} 
                      onClick={() => setSelectedFile(key)}
                      style={{ padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.875rem", background: activeFile === key ? "#094771" : "transparent", color: activeFile === key ? "#fff" : "#ccc" }}
                    >
                      📄 {key.split("/").pop()}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto" }}>
                  <div style={{ marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: "1px solid #333", color: "#858585", fontSize: "0.875rem" }}>{activeFile}</div>
                  <pre style={{ margin: 0, color: "#dcdcaa", fontSize: "0.875rem" }}>
                    <code>{activeFile ? fileSystem[activeFile] : ""}</code>
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}