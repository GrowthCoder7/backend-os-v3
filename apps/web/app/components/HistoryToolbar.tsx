"use client";

import React from "react";
import { useGraphStore } from "@repo/store";

export function HistoryToolbar() {
  const rawCanUndo = useGraphStore((state) => state.canUndo);
  const rawCanRedo = useGraphStore((state) => state.canRedo);
  const undo = useGraphStore((state) => state.undo);
  const redo = useGraphStore((state) => state.redo);

  const canUndo = typeof rawCanUndo === "function" ? (rawCanUndo as () => boolean)() : !!rawCanUndo;
  const canRedo = typeof rawCanRedo === "function" ? (rawCanRedo as () => boolean)() : !!rawCanRedo;

  const buttonStyle = (enabled: boolean) => ({
    padding: "0.5rem 1rem",
    background: enabled ? "#111827" : "#e5e7eb",
    color: enabled ? "#ffffff" : "#9ca3af",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "0.875rem",
    cursor: enabled ? "pointer" : "not-allowed",
    transition: "background 0.2s"
  });

  return (
    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", alignItems: "center" }}>
      <button 
        type="button" 
        onClick={undo} 
        disabled={!canUndo} 
        style={buttonStyle(canUndo)}
        aria-label="Undo"
      >
        ↺ Undo
      </button>
      <button 
        type="button" 
        onClick={redo} 
        disabled={!canRedo} 
        style={buttonStyle(canRedo)}
        aria-label="Redo"
      >
        Redo ↻
      </button>
    </div>
  );
}