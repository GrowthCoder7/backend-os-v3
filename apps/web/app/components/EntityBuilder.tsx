"use client";

import { useState } from "react";
import { useGraphStore } from "@repo/store";
import { validateGraph } from "@repo/validation";
import { ArchitectureGraph, Entity, Field, FieldType } from "@repo/types";

export function EntityBuilder() {
  const addEntity = useGraphStore((state) => state.addEntity);
  const currentGraph = useGraphStore((state) => state.graph);

  const [name, setName] = useState("");
  const [primaryKey, setPrimaryKey] = useState("id");
  const [fields, setFields] = useState<Field[]>([
    { name: "id", type: "string", required: true }
  ]);
  const [error, setError] = useState<string | null>(null);

  const handleAddField = () => {
    setFields([...fields, { name: "", type: "string", required: false }]);
  };

  const handleUpdateField = (index: number, key: keyof Field, value: string | boolean) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value } as Field;
    setFields(newFields);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    // 1. Sanitize local state
    const cleanName = name.trim();
    const cleanFields = fields.filter((f) => f.name.trim() !== "");

    if (!cleanName) {
      setError("Entity name is required.");
      return;
    }

    // 2. Construct provisional entity
    const newEntity: Entity = {
      name: cleanName,
      primaryKey: primaryKey.trim(),
      fields: cleanFields
    };

    // 3. Build provisional AST for pure validation
    const provisionalGraph: ArchitectureGraph = {
      ...currentGraph,
      entities: { ...currentGraph.entities, [cleanName]: newEntity }
    };

    // 4. Run semantic analysis
    const issues = validateGraph(provisionalGraph);
    const fatalErrors = issues.filter(issue => issue.severity === "error" && issue.nodeId === cleanName);

    // 5. Explicit UI Rejection
    if (fatalErrors.length > 0) {
      setError(fatalErrors.map(e => e.message).join(" | "));
      return;
    }

    // 6. Dispatch Validated State
    try {
      addEntity(newEntity);
      setError(null);
      setName("");
      setPrimaryKey("id");
      setFields([{ name: "id", type: "string", required: true }]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div style={{ padding: "1.5rem", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "2rem" }}>
      <h2 style={{ marginBottom: "1rem", fontSize: "1.25rem" }}>Entity Builder</h2>
      
      {error && (
        <div style={{ background: "#450a0a", color: "#fca5a5", padding: "0.75rem", borderRadius: "4px", marginBottom: "1rem", fontSize: "0.875rem" }}>
          ⚠️ VALIDATION REJECTED: {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.5rem" }}>
        <input
          placeholder="Entity Name (e.g., User)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "4px" }}
        />
        <input
          placeholder="Primary Key"
          value={primaryKey}
          onChange={(e) => setPrimaryKey(e.target.value)}
          style={{ flex: 1, padding: "0.5rem", background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "4px" }}
        />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem" }}>Fields</h3>
        {fields.map((field, index) => (
          <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
            <input
              placeholder="Field Name"
              value={field.name}
              onChange={(e) => handleUpdateField(index, "name", e.target.value)}
              style={{ flex: 2, padding: "0.5rem", background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "4px", fontSize: "0.875rem" }}
            />
            <select
              value={field.type}
              onChange={(e) => handleUpdateField(index, "type", e.target.value as FieldType)}
              style={{ flex: 1, padding: "0.5rem", background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "4px", fontSize: "0.875rem" }}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
              <option value="datetime">datetime</option>
              <option value="relation">relation</option>
              <option value="json">json</option>
              <option value="enum">enum</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.875rem" }}>
              <input
                type="checkbox"
                checked={field.required}
                onChange={(e) => handleUpdateField(index, "required", e.target.checked)}
              />
              Req
            </label>
            <button 
              onClick={() => handleRemoveField(index)}
              style={{ background: "transparent", border: "none", color: "#fca5a5", cursor: "pointer", padding: "0.25rem 0.5rem" }}
              title="Remove Field"
            >
              ✕
            </button>
          </div>
        ))}
        <button 
          onClick={handleAddField}
          style={{ background: "transparent", border: "1px dashed var(--border)", color: "var(--foreground)", padding: "0.5rem", borderRadius: "4px", cursor: "pointer", width: "100%", fontSize: "0.875rem", marginTop: "0.5rem" }}
        >
          + Add Field
        </button>
      </div>

      <button 
        onClick={handleCreate} 
        style={{ width: "100%", padding: "0.75rem", background: "var(--foreground)", color: "var(--background)", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}
      >
        Compile Entity to AST
      </button>
    </div>
  );
}