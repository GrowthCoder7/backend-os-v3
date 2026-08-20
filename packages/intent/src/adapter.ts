import { ExecutionContext, OperationExecutor } from "@repo/executor";
import { ArchitectureGraph } from "@repo/types";
import { IntentResponse, IntentOperation } from "@repo/ai";
import { 
  createEntityOperation, updateEntityOperation, deleteEntityOperation,
  createEndpointOperation, updateEndpointOperation, deleteEndpointOperation,
  createRelationOperation, updateRelationOperation, deleteRelationOperation
} from "@repo/operations";

export interface IntentExecutionResult {
  success: boolean;
  graph: ArchitectureGraph;
  diagnostics: any[]; 
}

export class IntentAdapter {
  constructor(private executor: OperationExecutor) {}

  public applyIntent(intent: IntentResponse, context: ExecutionContext): IntentExecutionResult {
    // 1. Status & Precondition Checks
    if (intent.status === "needs_clarification" || intent.status === "error") {
      if (intent.operations && intent.operations.length > 0) {
        throw new Error(`Contradictory AI intent: status is '${intent.status}' but operations were provided.`);
      }
      return { success: false, graph: context.graph, diagnostics: [{ type: "system", message: intent.message || intent.status }] };
    }

    if (intent.status !== "success") {
      throw new Error(`Unsupported AI status: ${intent.status}`);
    }

    if (!intent.operations || intent.operations.length === 0) {
      throw new Error("AI intent success requires at least one operation.");
    }

    // 2. Map to Canonical Operations (Preserving EXACT AI Order)
    const canonicalOperations = intent.operations.map((op: IntentOperation) => {
      const metadata = { source: "ai" as const };
      
      switch (op.type) {
        case "entity.create": return createEntityOperation(op.payload, metadata);
        case "entity.update": return updateEntityOperation(op.payload, metadata);
        case "entity.delete": return deleteEntityOperation(op.payload, metadata);
        case "endpoint.create": return createEndpointOperation(op.payload, metadata);
        case "endpoint.update": return updateEndpointOperation(op.payload, metadata);
        case "endpoint.delete": return deleteEndpointOperation(op.payload, metadata);
        case "relation.create": return createRelationOperation(op.payload, metadata);
        case "relation.update": return updateRelationOperation(op.payload, metadata);
        case "relation.delete": return deleteRelationOperation(op.payload, metadata);
        default: 
          // TypeScript exhaustive check protection
          const _exhaustiveCheck: never = op;
          throw new Error(`Unknown IntentOperation type encountered: ${(op as any).type}`);
      }
    });

    // 3. Atomic Commit Execution
    const originalGraph = context.graph;
    let currentGraph = originalGraph;

    for (const operation of canonicalOperations) {
      const result = this.executor.execute(operation, {
        ...context,
        graph: currentGraph
      });

      if (!result.success) {
        // Rollback immediately to original graph. Do not commit intermediate state.
        return {
          success: false,
          graph: originalGraph,
          diagnostics: result.diagnostics
        };
      }

      currentGraph = result.graph;
    }

    return {
      success: true,
      graph: currentGraph,
      diagnostics: []
    };
  }
}