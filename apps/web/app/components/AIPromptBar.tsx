"use client";

import { useState } from "react";
import { useGraphStore } from "@repo/store";
import type { IntentResponse } from "@repo/ai";

export function AIPromptBar() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "clarification">("idle");
  const [feedback, setFeedback] = useState("");
  const applyIntent = useGraphStore((state) => state.applyIntent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    setStatus("loading");
    setFeedback("Analyzing intent and compiling architecture...");

    try {
      // Secure server-side call
      const response = await fetch("/api/ai/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `HTTP ${response.status} Error`);
      }

      const intentResponse: IntentResponse = await response.json();

      // Handle AI clarification requests
      if (intentResponse.status === "needs_clarification") {
        setStatus("clarification");
        setFeedback(intentResponse.message || "Clarification needed.");
        return;
      }

      // Handle explicit AI interpretation errors
      if (intentResponse.status === "error") {
        setStatus("error");
        setFeedback(intentResponse.message || "Failed to parse intent.");
        return;
      }

      // Pass the securely retrieved IntentResponse to the Sprint 6 boundary
      const result: any = applyIntent(intentResponse);
      
      if (result.success) {
        setStatus("success");
        setFeedback("Architecture successfully updated.");
        setPrompt(""); // Clear input on success
      } else {
        // Handle executor rejection: extract and display diagnostics
        setStatus("error");
        const diagnosticsMessage = result.diagnostics && Array.isArray(result.diagnostics)
          ? result.diagnostics.map((d: any) => d.message).join(" | ")
          : "Execution rejected by compiler constraints.";
        setFeedback(`Execution Failed: ${diagnosticsMessage}`);
      }
    } catch (error: any) {
      setStatus("error");
      setFeedback(`System Error: ${error.message}`);
    }
  };

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "1.5rem", marginBottom: "2rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "1rem", color: "#111827" }}>Design with AI</h2>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem" }}>
        <input 
          style={{ flex: 1, padding: "0.75rem 1rem", border: "1px solid #d1d5db", borderRadius: "6px", fontSize: "1rem", outline: "none", transition: "border-color 0.2s" }}
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Create a User entity with id, name, and email fields. Add GET /users and POST /users."
          disabled={status === "loading"}
        />
        <button 
          type="submit" 
          disabled={status === "loading" || !prompt.trim()}
          style={{ padding: "0.75rem 1.5rem", background: status === "loading" ? "#9ca3af" : "#000000", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: "600", cursor: status === "loading" ? "not-allowed" : "pointer", transition: "background 0.2s" }}
        >
          {status === "loading" ? "Generating..." : "Generate"}
        </button>
      </form>
      
      {feedback && (
        <div style={{ 
          marginTop: "1rem", 
          padding: "0.75rem", 
          borderRadius: "6px", 
          fontSize: "0.875rem",
          background: status === "error" ? "#fef2f2" : status === "clarification" ? "#fffbeb" : "#f0fdf4",
          color: status === "error" ? "#991b1b" : status === "clarification" ? "#b45309" : "#166534",
          border: `1px solid ${status === "error" ? "#fecaca" : status === "clarification" ? "#fde68a" : "#bbf7d0"}`
        }}>
          {status === "error" && <strong>Error: </strong>}
          {status === "clarification" && <strong>Clarification Needed: </strong>}
          {feedback}
        </div>
      )}
    </div>
  );
}