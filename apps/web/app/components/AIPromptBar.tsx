"use client";
import React from "react";
import { useState } from "react";
import { useGraphStore } from "@repo/store";
import type { IntentResponse } from "@repo/ai";

export function AIPromptBar() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "clarification"
  >("idle");
  const [feedback, setFeedback] = useState("");

  const applyIntent = useGraphStore((state) => state.applyIntent);
  const currentGraph = useGraphStore((state) => state.graph);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) return;

    setStatus("loading");
    setFeedback("Understanding your architecture...");

    try {
      const response = await fetch("/api/ai/intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          graph: currentGraph,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        throw new Error(
          errorData?.message || `HTTP ${response.status} Error`
        );
      }

      const intentResponse: IntentResponse = await response.json();

      if (intentResponse.status === "needs_clarification") {
        setStatus("clarification");
        setFeedback(
          intentResponse.message || "More information is required."
        );
        return;
      }

      if (intentResponse.status === "error") {
        setStatus("error");
        setFeedback(
          intentResponse.message ||
            "AI could not produce a valid architecture."
        );
        return;
      }

      /*
       * Successful AI intent enters:
       *
       * IntentAdapter
       *      ↓
       * Operation factories
       *      ↓
       * OperationExecutor
       *      ↓
       * Validation
       *      ↓
       * Atomic graph commit
       */
      const result = applyIntent(intentResponse);

      if (result.success) {
        setStatus("success");
        setFeedback("Architecture successfully updated.");
        setPrompt("");
      } else {
        setStatus("error");

        const diagnosticsMessage = result.diagnostics
          ?.map((diagnostic) => diagnostic?.message)
          .filter(Boolean)
          .join(" | ") || result.message || "Execution rejected by compiler constraints.";

        setFeedback(
          `Execution Failed: ${
            diagnosticsMessage || "Execution rejected by compiler constraints."
          }`
        );
      }
    } catch (error: unknown) {
      setStatus("error");

      const message =
        error instanceof Error
          ? error.message
          : "Unknown system error.";

      setFeedback(`System Error: ${message}`);
    }
  };

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "1.5rem",
        marginBottom: "2rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
      }}
    >
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: "600",
          marginBottom: "1rem",
          color: "#111827",
        }}
      >
        Design with AI
      </h2>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          gap: "0.75rem",
        }}
      >
        <input
          style={{
            flex: 1,
            padding: "0.75rem 1rem",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "1rem",
            outline: "none",
            transition: "border-color 0.2s",
          }}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g., "Add a relation with User1 (one) to Posts (many)"'
          disabled={status === "loading"}
        />

        <button
          type="submit"
          disabled={status === "loading" || !prompt.trim()}
          style={{
            padding: "0.75rem 1.5rem",
            background: status === "loading" ? "#9ca3af" : "#000000",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "600",
            cursor:
              status === "loading" ? "not-allowed" : "pointer",
            transition: "background 0.2s",
          }}
        >
          {status === "loading" ? "Generating..." : "Generate"}
        </button>
      </form>

      {feedback && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "6px",
            fontSize: "0.875rem",
            background:
              status === "error"
                ? "#fef2f2"
                : status === "clarification"
                  ? "#fffbeb"
                  : status === "success"
                    ? "#f0fdf4"
                    : "#f3f4f6",
            color:
              status === "error"
                ? "#991b1b"
                : status === "clarification"
                  ? "#b45309"
                  : status === "success"
                    ? "#166534"
                    : "#374151",
            border:
              status === "error"
                ? "1px solid #fecaca"
                : status === "clarification"
                  ? "1px solid #fde68a"
                  : status === "success"
                    ? "1px solid #bbf7d0"
                    : "1px solid #e5e7eb",
          }}
        >
          {status === "error" && <strong>Error: </strong>}

          {status === "clarification" && (
            <strong>Clarification Needed: </strong>
          )}

          {feedback}
        </div>
      )}
    </div>
  );
}