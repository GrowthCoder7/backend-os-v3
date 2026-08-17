export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "relation"
  | "json"
  | "enum";


export interface Field {

  name: string;

  type: FieldType;

  required: boolean;

}



export interface Entity {

  name: string;

  fields: Field[];

  primaryKey: string;

}



export interface Relation {

  source: string;

  sourceField: string;

  target: string;

  targetField: string;

  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

}



export interface Endpoint {

  method: "GET" | "POST" | "PUT" | "DELETE";

  path: string; // FIXED: Strict Routing Enforced

  entity: string;

  action: "create" | "read" | "update" | "delete";

}



export interface Event {

  name: string;

  payloadSchema: Record<string, FieldType>; // FIXED: Typed Payloads Enabled

}



export interface PipelineStep {

  name: string;

  type: "core" | "custom";

  config?: Record<string, unknown>; // FIXED: Strict Static Analysis Enforced

}



export interface Workflow {

  triggerEvent: string;

  steps: PipelineStep[];

}

export interface ProjectMetadata  {
  id:string
  name:string
  description?:string
  version?:string
  createdAt:string
  updatedAt:string
  compilerVersion:string
  schemaVersion:string
}

export interface ArchitectureGraph {

  metadata:ProjectMetadata

  entities: Record<string, Entity>;

  relations: Relation[];

  endpoints: Endpoint[];

  events: Record<string, Event>;

  workflows: Workflow[];

}

// ==========================================
// BACKEND IR (INTERMEDIATE REPRESENTATION)
// ==========================================

export interface CompiledModel {
  tableName: string;
  primaryKey: string;
  fields: Field[]; // Passed through for generator plugins
  relations: Relation[]; // Scoped relations for this specific model
}

export interface CompiledRoute {
  method: string;
  path: string;
  handlerId: string;
  entity: string;
  action: "create" | "read" | "update" | "delete";
}

export interface CompiledWorkflow {
  triggerEvent: string;
  executionSteps: number;
  steps: PipelineStep[];
}

export interface DatabaseIR {
  models: CompiledModel[];
}

export interface ApiIR {
  routes: CompiledRoute[];
}

export interface WorkflowIR {
  workflows: CompiledWorkflow[];
}

export interface BackendIR {
  database: DatabaseIR;
  apis: ApiIR;
  workflows: WorkflowIR;
  events: Record<string, Event>;
  metadata: {
    version: string;
    generatedAt: string;
  };
}

export interface GeneratedArtifacts {
  prisma?: string;
  server?: string;      // Express initialization
  routes?: string;      // Express router definitions
  controllers?: string; // Route handlers
}