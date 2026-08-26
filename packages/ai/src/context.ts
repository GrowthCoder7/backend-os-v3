import { ArchitectureGraph } from "@repo/types";

export function serializeGraphContext(graph: ArchitectureGraph): string {
  // Deterministic serialization of read-only architecture state
  const entities = Object.keys(graph.entities)
    .sort()
    .map((name) => {
      const e = graph.entities[name];
      const fields = [...e.fields]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((f) => ({ name: f.name, type: f.type, required: f.required }));
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

  return JSON.stringify({ entities, relations, endpoints }, null, 2);
}