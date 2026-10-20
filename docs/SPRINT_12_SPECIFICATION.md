# Backend OS V3 — Sprint 12 Specification

**Title:** Guided Run and API Cockpit  
**Architecture:** V1.0 — Frozen  
**Status:** Planning baseline; acceptance pending implementation and Docker verification  
**Sprint scope:** Project lifecycle/persistence, guided generation/runtime, API cockpit, and repeatable TaskFlow demo  
**Explicit exclusion:** Deployment-provider integration

## 1. Governing Constraints

- The Project Constitution, Architecture Specification, Domain Model Specification, accepted ADRs, and accepted engineering decisions retain their established authority order.
- Architecture V1.0 is frozen. Do not redesign the Architecture Graph, operation pipeline, compiler pipeline, Backend IR, package boundaries, or generator contract as a convenience for Sprint 12.
- All architecture mutations continue through Architecture Operations and the Operation Executor.
- Distinguish PostgreSQL/Prisma persistence inside generated applications from persistence of Backend OS Projects and Architecture Graphs.
- Do not claim completion without source-backed changes and actual verification results. Builds, tests, and type-checks run through Docker.

## 2. Phase 0 / Contract Gate (P12-00)

**Owner:** Engineering Lead coordinates; Dev A and Dev B provide evidence for their scopes.  
**Status:** Open until source review and decision record are complete.

Required outputs:

1. Source-level inspection of actual project/domain types, graph store, mutation paths, history, project UI, serialization, and any existing storage adapter.
2. Findings marked separately as source-verified facts, documentation-derived facts, assumptions, or unverified items.
3. A reviewed persistence public contract and serialized-project envelope based on actual types.
4. Formal resolution, through the applicable RFC/ADR process, of any confirmed discrepancy between stable-identity requirements and actual implementation.
5. Agreed cross-track contracts for guided run, proxy, project persistence, and UI integration.

**Gate:** P12-01 must not implement durable persistence until the identity contract has been verified and formally resolved if a real discrepancy exists. This does not block independent planning or safe progress on guided-run/API-cockpit work.

## 3. P12-01 — Project Lifecycle and Persistence

**Owner:** Dev B. **Review:** Engineering Lead; Dev A reviews only required cross-track interfaces.

### Scope

- Project-level create, list, open, save/update, rename, delete, and explicitly defined import/export.
- Provider-independent repository boundary. IndexedDB is a candidate local provider, not a frozen architectural requirement until current code and contracts are inspected.
- Canonical serialization preserving project identity/metadata, configuration, graph structure/references/metadata/version, and required schema/compiler metadata without duplicate editable graph state.
- Atomic saves that preserve the last valid revision if a write fails.
- Clear typed outcomes for conflicts, missing projects, validation failures, schema incompatibility, and storage failures.
- Project isolation, safe deletion behavior, and conflict handling during import.
- Project UI controls distinct from entity-level create controls.
- Visible save state, including `IDLE`, `UNSAVED_CHANGES`, `SAVING`, `SAVED`, and `ERROR`.
- Restore only after validation succeeds; active-project activation and graph replacement must not expose partial state; history baseline reset occurs only after successful activation.

### Acceptance Criteria

- Create/list/open/update/rename/delete work without overwriting unrelated projects.
- Duplicate IDs cause explicit conflict unless a reviewed import-remapping policy is invoked.
- Saved work survives refresh and a new browser session on the same browser profile for the chosen local provider.
- Serialization round-trip preserves all canonical project/graph information.
- Concurrent/out-of-order writes cannot silently overwrite a newer persisted revision with an older snapshot.
- Edits made during an in-flight save remain dirty and are queued for persistence.
- Failed save preserves the previous persisted project and reports a visible diagnostic.
- Invalid/corrupt/incompatible payloads leave active project, graph, and history unchanged.
- After a successful open, history begins from the restored graph baseline and subsequent undo/redo works.
- Do not claim cloud or cross-device sync.

### Persistence Contract Notes

The final `SerializedProject`, `ProjectMetadata`, repository methods, error types, and schema/version fields are not frozen by this specification alone. Dev B must confirm actual physical types and resolve the identity gate before code begins. A discriminated result union does not by itself guarantee transactional/atomic saving; provider semantics and tests must prove this property.

## 4. P12-02 — Guided Generation and Runtime Lifecycle

**Runtime owner:** Dev A. **UI integration:** Dev B. **Contract coordination:** Engineering Lead.

### Scope

- Explicit stage reporting for validation, generation, materialization, installation, database preparation, build, startup, and readiness.
- Truthful stage ownership: runtime coordinator reports only stages it actually owns and receives already-computed IR/files as defined by the approved contract.
- Failure reports identify the actual failed stage. No failed run may become READY.
- Preserve primary failures and report cleanup/termination failures separately.
- Stop, Restart, and Reset/Cleanup are distinct operations.
- Stop terminates the process and preserves generated files, database schema, and application data.
- Restart reuses the same generated project/schema and preserves rows; failed-start recovery reruns prerequisites that did not complete.
- Reset/Cleanup is explicit, limited to validated test resources, and does not continue destructively after an unconfirmed process termination.
- Reject simultaneous run registrations that claim the same normalized output directory or the same validated database/schema resource.

### Acceptance Criteria

- A run reaches READY only after actual readiness succeeds.
- Failures in materialization, installation, database preparation, build, and startup are reported accurately.
- Retry/recovery behavior is stage-aware and cannot build from partial materialization.
- Stop/restart preserve records; Reset/Cleanup safely releases resources and reports partial failures.
- Concurrent resource conflicts are rejected reliably.
- Logs are bounded by bytes and lines, redacted before storage and observer delivery, and do not leak credentials.

## 5. P12-03 — API Cockpit

**Runtime/API boundary:** Dev A. **Product UI:** Dev B.

### Scope

- Route/method catalogue derived from Backend IR.
- Request fields: approved method, canonical path, query parameters, permitted headers, and bounded JSON body where applicable.
- Response: actual status code, safely filtered headers, body, elapsed duration, and stable error object.
- Target is the currently owned runtime instance using a server-owned loopback port; clients cannot supply a destination host or arbitrary URL.
- Reject absolute/protocol-relative paths, malformed encodings, encoded separators, traversal, ambiguous path delimiters, unsupported routes/methods, and inactive runs before forwarding.
- Bounded request and response payloads; enforce response limit while consuming the body, not only through Content-Length.
- Timeout covers response-body processing. Return stable timeout, malformed request, oversized payload, route-not-found, inactive-run, and downstream-failure outcomes.
- Filter unsafe/hop-by-hop headers and redact secrets from logs/errors.

### Acceptance Criteria

- Valid dynamic routes proxy successfully against a controlled local HTTP server.
- Invalid/unknown routes and methods never reach the server.
- Query parameters, allowed headers, JSON requests, JSON and non-JSON responses, status codes, and safe response headers are correctly handled.
- Malformed encodings, traversal variants, oversized request/response streams, and body-read timeouts are tested.
- No test bypasses private state using `any`; use a typed injectable orchestrator/transport or controlled test adapter.

## 6. P12-04 — TaskFlow Demo and Recovery

The fixture must use the currently accepted graph contracts and include:

- Project name: `TaskFlow-QA-Persistence-01`
- `User`: required primary-key `id` (string), required `email` (string)
- `Task`: required primary-key `id` (string), required `title` (string), required `status` (string), required `assigneeId` (string)
- One-to-many relationship from User to Task using the approved relation semantics
- `GET` and `POST` routes for `/users` and `/tasks` as generated by the actual current generator

Acceptance path:

1. Create/edit the TaskFlow architecture through the canonical editing pipeline.
2. Save and reopen the project after P12-01 is unblocked; verify complete graph fidelity.
3. Generate, build, start, and wait for readiness.
4. Create a User and a Task that references the existing User through the live HTTP API.
5. Verify foreign-key rejection behavior for an invalid reference against the established generator error contract.
6. Stop and restart the process and verify the previously created rows remain.
7. Trigger a controlled validation/build/startup failure and demonstrate actionable diagnostics and recovery.
8. Mark features absent from the product as `GAP`, not `FAIL`, while noting the missing implementation.

## 7. Cross-Track Contract Freeze

Before parallel implementation, freeze at minimum:

- RunCoordinator public lifecycle methods, status and progress events, callback error semantics, and restart/reset boundaries.
- API proxy request/response types, route matching contract, limits, and stable error codes.
- ProjectRepository methods, typed outcomes, atomic-save behavior, serialized envelope, revision/concurrency strategy, and import conflict policy.
- UI save-state machine and active-project lifecycle behavior.

No contributor should independently redefine these types. Any change crossing public package boundaries must be reconciled before integration.

## 8. Required Verification

All commands must execute through Docker. Record command, exit status, test count, and actual output/reference for every completed check.

Minimum gate:

- Docker build-check image builds successfully.
- Type-check command is confirmed to cover each intended package; do not call a partial Turborepo task graph a whole-repository check.
- Prisma/NestJS generator tests pass with deterministic-output permutation tests.
- Runtime lifecycle/proxy tests cover the acceptance cases above using real controlled HTTP transport where appropriate.
- Sprint 11 E2E remains 8/8 passing.
- `git diff --check` passes.
- No unrelated changes are discarded; no reset/clean command is permitted without explicit approval.

## 9. Definition of Done

A workstream is complete only when its public contract is frozen, implementation is integrated, targeted tests pass, regression checks pass, failure behavior is demonstrated, documentation is reconciled, and evidence is recorded. AI-generated implementation summaries alone are not verification evidence.
