import { ArchitectureGraph } from "@repo/types";

// Helper to safely and deeply sort object keys for deterministic serialization
// Preserves array order natively, applying type-safe recursion for nested records.
function deepSortObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(deepSortObject);
  
  const record = obj as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  Object.keys(record).sort().forEach(key => {
    sorted[key] = deepSortObject(record[key]);
  });
  return sorted;
}

export function serializeGraphContext(graph: ArchitectureGraph): string {
  // Deterministic serialization of read-only architecture state
  const entities = Object.entries(graph.entities)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, e]) => {
    const fields = [...e.fields]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
      }));

    return { name: e.name, primaryKey: e.primaryKey, fields };
  });

  const relations = [...graph.relations].sort(
    (a, b) =>
      a.source.localeCompare(b.source) ||
      a.sourceField.localeCompare(b.sourceField) ||
      a.target.localeCompare(b.target) ||
      a.targetField.localeCompare(b.targetField)
  );

  const endpoints = [...graph.endpoints].sort(
    (a, b) => a.method.localeCompare(b.method) || a.path.localeCompare(b.path)
  );

  // Deterministic Event serialization
  const events = Object.entries(graph.events)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, e]) => {
    const payloadSchema = Object.fromEntries(
      Object.entries(e.payloadSchema).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    );

    return { name: e.name, payloadSchema };
  });

  // Deterministic Workflow serialization
  const workflows = [...graph.workflows]
    .sort((a, b) => a.triggerEvent.localeCompare(b.triggerEvent))
    .map((w) => ({
      triggerEvent: w.triggerEvent,
      // Pipeline step order is intentionally preserved
      steps: w.steps.map((s) => ({
        name: s.name,
        type: s.type,
        config: s.config !== undefined ? (deepSortObject(s.config) as Record<string, unknown>) : undefined
      }))
    }));

  return JSON.stringify({ entities, relations, endpoints, events, workflows }, null, 2);
}