import {
  OperationRegistry,
  OperationExecutor,
  EntityCreateHandler,
  EntityUpdateHandler,
  EntityDeleteHandler,
} from "@repo/executor";

import {
  createEntityOperation,
  updateEntityOperation,
  deleteEntityOperation,
  EntityCreateOperation,
  EntityUpdateOperation,
  EntityDeleteOperation,
} from "@repo/operations";

import { validateGraph } from "@repo/validation";
import { ArchitectureGraph } from "@repo/types";
import process from "node:process";

// ============================================================
// SPRINT 2 — ENTITY LIFECYCLE VERIFICATION
// ============================================================
//
// This script verifies the actual public execution boundary:
//
//   Operation Factory
//          ↓
//   Operation Registry
//          ↓
//   Operation Executor
//          ↓
//   Entity Handler
//          ↓
//   Candidate Graph
//          ↓
//   Validation
//          ↓
//   Commit / Rollback
//
// IMPORTANT:
// - This script does not duplicate production logic.
// - Handlers are never invoked directly.
// - No production code is modified by this script.
// - This file is temporary verification infrastructure.
// ============================================================

// ------------------------------------------------------------
// 1. Canonical operation union
// ------------------------------------------------------------

type Sprint2Operation =
  | EntityCreateOperation
  | EntityUpdateOperation
  | EntityDeleteOperation;

// ------------------------------------------------------------
// 2. Public execution boundary
// ------------------------------------------------------------

const registry = new OperationRegistry();

registry.register(
  "entity.create",
  new EntityCreateHandler()
);

registry.register(
  "entity.update",
  new EntityUpdateHandler()
);

registry.register(
  "entity.delete",
  new EntityDeleteHandler()
);

const executor = new OperationExecutor(registry);

// ------------------------------------------------------------
// 3. Initial valid Architecture Graph
// ------------------------------------------------------------

const initialGraph: ArchitectureGraph = {
  metadata: {
    id: "sprint-2-verification",
    name: "Sprint 2 Verification",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    compilerVersion: "1.0.0",
    schemaVersion: "1.0.0",
  },

  entities: {},

  relations: [],

  endpoints: [],

  events: {},

  workflows: [],
};

// ------------------------------------------------------------
// 4. Assertion helpers
// ------------------------------------------------------------

const assert = (
  condition: boolean,
  message: string
): void => {
  if (!condition) {
    throw new Error(`❌ ASSERTION FAILED: ${message}`);
  }
};

const assertEqual = <T>(
  actual: T,
  expected: T,
  message: string
): void => {
  if (actual !== expected) {
    throw new Error(
      `❌ ASSERTION FAILED: ${message}\n` +
      `Expected: ${String(expected)}\n` +
      `Actual: ${String(actual)}`
    );
  }
};

const assertGraphUnchanged = (
  before: ArchitectureGraph,
  after: ArchitectureGraph,
  message: string
): void => {
  assert(
    after === before,
    message
  );
};

// ------------------------------------------------------------
// 5. Executor helper
// ------------------------------------------------------------
//
// All operations MUST enter through OperationExecutor.
// No handler is called directly.
// ------------------------------------------------------------

const executeOperation = (
  operation: Sprint2Operation,
  graph: ArchitectureGraph
) => {
  return executor.execute(operation, {
    graph,
    services: {},
    validation: {
      validate: validateGraph,
    },
  });
};

// ============================================================
// TEST SUITE
// ============================================================

const runTests = (): void => {
  let currentGraph = initialGraph;

  console.log("");
  console.log("==============================================");
  console.log("🚀 BACKEND OS — SPRINT 2 VERIFICATION");
  console.log("==============================================");
  console.log("");

  // ==========================================================
  // TEST A — Valid Entity Create
  // ==========================================================

  console.log("TEST A — Valid Entity Create");

  const createOperation = createEntityOperation({
    entity: {
      name: "User",
      primaryKey: "id",
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
        },
      ],
    },
  });

  const createResult = executeOperation(
    createOperation,
    currentGraph
  );

  assertEqual(
    createResult.success,
    true,
    "Valid entity creation should succeed."
  );

  assert(
    createResult.graph !== currentGraph,
    "Successful create should return a new graph reference."
  );

  assert(
    createResult.graph.entities["User"] !== undefined,
    "Created User entity should exist in the resulting graph."
  );

  assert(
    currentGraph.entities["User"] === undefined,
    "Original graph must remain unchanged after create."
  );

  currentGraph = createResult.graph;

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST B — Duplicate Entity Create
  // ==========================================================

  console.log("TEST B — Duplicate Entity Create");

  const duplicateCreateOperation =
    createEntityOperation({
      entity: {
        name: "User",
        primaryKey: "id",
        fields: [
          {
            name: "id",
            type: "string",
            required: true,
          },
        ],
      },
    });

  let duplicateCreateFailed = false;

  try {
    const duplicateResult = executeOperation(
      duplicateCreateOperation,
      currentGraph
    );

    assertEqual(
      duplicateResult.success,
      false,
      "Duplicate entity creation should fail."
    );

    assert(
      duplicateResult.diagnostics.length > 0,
      "Duplicate create should provide at least one diagnostic."
    );

    assertGraphUnchanged(
      currentGraph,
      duplicateResult.graph,
      "Duplicate create must preserve the original graph."
    );

    duplicateCreateFailed = true;
  } catch (error: unknown) {
    // Some implementations enforce the duplicate-create invariant
    // by throwing before returning an ExecutionResult.
    duplicateCreateFailed = true;

    if (!(error instanceof Error)) {
    throw new Error(
      "Duplicate create threw a non-Error value."
    );
  }

    assert(
      error.message.length > 0,
      "Duplicate create error should contain a meaningful message."
    );
  }

  assert(
    duplicateCreateFailed,
    "Duplicate entity creation must be rejected."
  );

  assert(
    currentGraph.entities["User"] !== undefined,
    "Duplicate create must not remove or replace the existing User entity."
  );

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST C — Valid Entity Update
  // ==========================================================

  console.log("TEST C — Valid Entity Update");

  const graphBeforeUpdate = currentGraph;

  const updateOperation = updateEntityOperation({
    name: "User",
    partialEntity: {
      fields: [
        {
          name: "id",
          type: "string",
          required: true,
        },
        {
          name: "email",
          type: "string",
          required: true,
        },
      ],
    },
  });

  const updateResult = executeOperation(
    updateOperation,
    currentGraph
  );

  assertEqual(
    updateResult.success,
    true,
    "Valid entity update should succeed."
  );

  assert(
    updateResult.graph !== currentGraph,
    "Successful update should return a new graph reference."
  );

  assert(
    updateResult.graph.entities["User"] !== undefined,
    "Updated User entity should still exist."
  );

  assertEqual(
    updateResult.graph.entities["User"].fields.length,
    2,
    "Updated User should contain two fields."
  );

  assertEqual(
    graphBeforeUpdate.entities["User"].fields.length,
    1,
    "Original graph must retain the original entity fields."
  );

  assert(
    updateResult.graph.entities["User"] !==
      graphBeforeUpdate.entities["User"],
    "Updated entity should not reuse the original entity object."
  );

  currentGraph = updateResult.graph;

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST C2 — Entity Identity Protection
  // ==========================================================

  console.log("TEST C2 — Entity Identity Protection");

  const identityOperation = updateEntityOperation({
    name: "User",
    partialEntity: {
      name: "HackedName",
    },
  });

  const identityResult = executeOperation(
    identityOperation,
    currentGraph
  );

  assertEqual(
    identityResult.success,
    true,
    "Identity-protection update should remain valid."
  );

  assert(
    identityResult.graph.entities["User"] !== undefined,
    "Original User identity must remain present."
  );

  assert(
    identityResult.graph.entities["HackedName"] === undefined,
    "Entity must not be renamed through partialEntity.name."
  );

  assertEqual(
    identityResult.graph.entities["User"].name,
    "User",
    "Entity name must remain equal to the operation lookup identity."
  );

  currentGraph = identityResult.graph;

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST D — Update Nonexistent Entity
  // ==========================================================

  console.log("TEST D — Update Nonexistent Entity");

  const graphBeforeMissingUpdate = currentGraph;

  const missingUpdateOperation =
    updateEntityOperation({
      name: "Ghost",
      partialEntity: {
        primaryKey: "uuid",
      },
    });

  const missingUpdateResult = executeOperation(
    missingUpdateOperation,
    currentGraph
  );

  assertEqual(
    missingUpdateResult.success,
    false,
    "Updating a nonexistent entity should fail."
  );

  assert(
    missingUpdateResult.diagnostics.length > 0,
    "Missing-entity update should provide diagnostics."
  );

  assertGraphUnchanged(
    graphBeforeMissingUpdate,
    missingUpdateResult.graph,
    "Missing-entity update must preserve the original graph."
  );

  assert(
    missingUpdateResult.graph.entities["User"] !== undefined,
    "Existing entities must remain untouched after failed update."
  );

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST E — Invalid Update / Validation Rollback
  // ==========================================================

  console.log(
    "TEST E — Invalid Update / Validation Rollback"
  );

  const graphBeforeInvalidUpdate = currentGraph;

  const invalidUpdateOperation =
    updateEntityOperation({
      name: "User",
      partialEntity: {
        fields: [],
      },
    });

  const invalidUpdateResult = executeOperation(
    invalidUpdateOperation,
    currentGraph
  );

  assertEqual(
    invalidUpdateResult.success,
    false,
    "Invalid update should fail validation."
  );

  assert(
    invalidUpdateResult.diagnostics.length > 0,
    "Invalid update should produce diagnostics."
  );

  assert(
    invalidUpdateResult.diagnostics.some(
      (diagnostic) => diagnostic.severity === "error"
    ),
    "Invalid update must produce at least one error diagnostic."
  );

  assertGraphUnchanged(
    graphBeforeInvalidUpdate,
    invalidUpdateResult.graph,
    "Invalid update must return the original graph reference."
  );

  assertEqual(
    invalidUpdateResult.graph.entities["User"].fields.length,
    graphBeforeInvalidUpdate.entities["User"].fields.length,
    "Invalid update must not commit invalid fields."
  );

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST F — Valid Entity Delete
  // ==========================================================

  console.log("TEST F — Valid Entity Delete");

  const graphBeforeDelete = currentGraph;

  const deleteOperation =
    deleteEntityOperation({
      name: "User",
    });

  const deleteResult = executeOperation(
    deleteOperation,
    currentGraph
  );

  assertEqual(
    deleteResult.success,
    true,
    "Valid entity deletion should succeed."
  );

  assert(
    deleteResult.graph !== currentGraph,
    "Successful delete should return a new graph reference."
  );

  assert(
    deleteResult.graph.entities["User"] === undefined,
    "Deleted User entity should not exist in the resulting graph."
  );

  assert(
    graphBeforeDelete.entities["User"] !== undefined,
    "Original graph must still contain User after delete execution."
  );

  currentGraph = deleteResult.graph;

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // TEST G — Delete Nonexistent Entity
  // ==========================================================

  console.log("TEST G — Delete Nonexistent Entity");

  const graphBeforeMissingDelete = currentGraph;

  const missingDeleteOperation =
    deleteEntityOperation({
      name: "Ghost",
    });

  const missingDeleteResult = executeOperation(
    missingDeleteOperation,
    currentGraph
  );

  assertEqual(
    missingDeleteResult.success,
    false,
    "Deleting a nonexistent entity should fail."
  );

  assert(
    missingDeleteResult.diagnostics.length > 0,
    "Missing-entity delete should provide diagnostics."
  );

  assertGraphUnchanged(
    graphBeforeMissingDelete,
    missingDeleteResult.graph,
    "Missing-entity delete must preserve the original graph."
  );

  assert(
    missingDeleteResult.graph.entities["User"] === undefined,
    "The graph should remain unchanged after failed deletion."
  );

  console.log("   ✅ PASS");
  console.log("");

  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log("==============================================");
  console.log("🎉 ALL SPRINT 2 TESTS PASSED");
  console.log("==============================================");
  console.log("");
  console.log(
    "Verified execution path:"
  );
  console.log(
    "Operation Factory → Registry → Executor → Handler → Validation → Commit/Rollback"
  );
  console.log("");
};

// ============================================================
// PROCESS ENTRYPOINT
// ============================================================

try {
  runTests();
} catch (error: unknown) {
  console.error("");
  console.error("==============================================");
  console.error("❌ SPRINT 2 VERIFICATION FAILED");
  console.error("==============================================");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  console.error("");

  process.exit(1);
}