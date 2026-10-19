# Sprint 12 — Guided Run and API Cockpit

## Architecture Guard

Architecture Version 1.0 is frozen. This sprint must use the established
Architecture Graph, Architecture Operation Executor, Compiler Pipeline,
Backend IR, generator contracts, ProjectMaterializer, and RuntimeOrchestrator.
No architectural redesign or deployment-provider integration is in scope.

## P12-01 — Project Lifecycle and Persistence

Owner: Dev B
Review: Dev A

Acceptance criteria:

- Create, list, open, save, rename, delete, and supported import/export
  operations are accessible through the product UI.
- A saved project survives refresh and reopening the application.
- Project metadata, architecture, relationships, endpoints, and graph version
  are preserved by serialization and restoration.
- Project isolation is verified: editing or deleting one project does not
  alter another project.
- The UI visibly distinguishes saving, saved, unsaved, and failed-save states.
- Invalid or incompatible saved data is rejected without replacing the
  active graph with a partial restore.
- All architectural mutations continue through the canonical editing pipeline.

Blocker: Implementation must not invent a stable-identity scheme that
contradicts the Domain Model Specification. Resolve the identity discrepancy
through the approved decision process first.

## P12-02 — Guided Generation and Runtime Lifecycle

Owner: Dev A
UI integration: Dev B

Acceptance criteria:

- Validation, generation, materialization, installation, database preparation,
  build, startup, and readiness are presented as explicit stages.
- Progress events correspond to the stage actually executing.
- A failure reports the actual failed stage and preserves useful diagnostics.
- A failed run never transitions to READY.
- Stop terminates the process without deleting the generated directory,
  database schema, or application rows.
- Restart reuses the same generated project and database so saved rows remain.
- Reset/Cleanup is explicit, restricted to verified test resources, and
  reports cleanup failures.

## P12-03 — API Cockpit

Runtime contract: Dev A
Product presentation and integration: Dev B

Acceptance criteria:

- The visible route catalogue is derived from Backend IR, not a separate
  hard-coded source of architectural truth.
- Requests support the allowed method, path, query parameters, headers, and
  body fields.
- Results show the actual status code, response body, relevant response
  headers, and request duration.
- Unknown routes, unsupported methods, inactive runs, malformed paths, and
  unsafe path inputs are rejected safely.
- Request timeouts remain active through response-body processing.
- Request/response handling is bounded and sensitive data is not exposed
  through logs or error messages.

## P12-04 — Repeatable TaskFlow Demonstration

Acceptance criteria:

- Use a known TaskFlow fixture with User and Task entities, the approved
  relation, and GET/POST endpoints.
- Save and restore the architecture; verify the same entities, fields,
  relationship, and endpoints remain.
- Create a User and a related Task through the generated HTTP API.
- Verify invalid foreign-key behavior matches the existing generated-backend
  error contract.
- Stop and restart the generated backend and verify existing rows persist.
- Demonstrate a failed run and successful recovery.
- Mark features absent from the product as GAP rather than recording a
  failing result for a feature not yet implemented.

## Verification

- Preserve Sprint 11 E2E verification: 8/8 passing.
- Run builds, tests, and type-check commands through Docker.
- Record the exact executed command, exit status, and test count.
- Do not claim repository-wide type-check success when only selected packages
  or configured task-graph entries ran.
- No sprint item is complete solely because an AI coding agent reports success.