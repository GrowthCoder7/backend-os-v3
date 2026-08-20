"use client";

import { useState } from "react";
import { useGraphStore } from "@repo/store";
import { AIProvider } from "@repo/ai";

// Ensure AIProvider instantiation matches Dev A's implementation
const aiProvider = new AIProvider(); 

export function AIPromptBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const applyIntent = useGraphStore((state) => state.applyIntent);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setFeedback("Thinking...");

    try {
      const intentResponse = await aiProvider.parseIntent({ prompt });
      const result = applyIntent(intentResponse);
      setFeedback(result.message || (result.success ? "Success" : "Failed to apply intent"));
    } catch (error: any) {
      setFeedback(`System Error: ${error.message}`);
    } finally {
      setLoading(false);
      setPrompt("");
    }
  };

  return (
    <div style={{ padding: "1rem", borderTop: "1px solid #ccc", background: "#f9f9f9" }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input 
          style={{ flex: 1, padding: "0.5rem" }}
          type="text" 
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Create a User entity with id, name, email and add GET /users"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? "Processing..." : "Generate"}
        </button>
      </form>
      {feedback && <div style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: feedback.includes("Error") || feedback.includes("Failed") ? "red" : "blue" }}>{feedback}</div>}
    </div>
  );
}