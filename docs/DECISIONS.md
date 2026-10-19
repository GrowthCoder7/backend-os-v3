## D-007 — Complete Entity Lifecycle

**Date:** 2026-08-12  
**Category:** Engineering / Implementation  
**Status:** Accepted

### Context

Sprint 1 established the first Architecture Operation vertical slice
using `entity.create`.

Sprint 2 was designed to prove that the same operation execution
architecture could support the complete entity lifecycle without
introducing a second mutation mechanism.

### Decision

Entity creation, update, and deletion are all implemented through
the canonical:

Architecture Operation
→ Executor
→ Candidate Graph
→ Validation
→ Commit / Rollback

pipeline.

The canonical operation contracts are owned by `@repo/operations`.

The executor consumes those contracts and owns execution behavior.

The Store routes entity mutations through the executor rather than
implementing independent graph mutation logic.

Entity renaming is explicitly outside the Sprint 2 scope.

### Verification

Sprint 2 was verified against the actual repository using the
repository-resident `verify-sprint2.ts` integration harness.

The verification covered:

- entity creation
- entity update
- nonexistent entity update rejection
- invalid update rollback
- entity identity protection
- entity deletion
- nonexistent entity deletion rejection
- referential-integrity deletion rejection
- duplicate-create regression
- compiler compatibility

Repository-level verification also passed:

- `npm --workspace=web run check-types`
- `npm run build`
- Sprint 2 integration verification via `verify-sprint2.ts`

The verification was executed against the actual repository rather
than being accepted solely on the basis of an AI-generated
implementation report.

### Consequences

The Operation / Executor architecture is now demonstrated across the
complete entity lifecycle.

Future mutation domains should reuse this architecture rather than
introducing independent mutation pathways.

The Architecture Graph schema and compiler architecture required no
changes to support the entity lifecycle.

The repository now contains a repeatable Sprint 2 verification harness
that can be rerun whenever the Editing Engine is modified.

Entity lifecycle support is considered complete for Sprint 2.
The broader Editing Engine remains in progress because history,
undo/redo, and additional mutation domains are still outside the
completed Sprint 2 scope.

---

# D-008 — Relation and Endpoint Operation Execution

## Decision

Relations and endpoints are modified exclusively through the canonical
Architecture Operation → Executor → Candidate Graph → Validation →
Commit / Rollback pipeline, consistent with the entity lifecycle pattern.

## Context

Sprint 3 expanded the Editing Engine to support complete relation and
endpoint execution surfaces. All operation types (create, update, delete)
were implemented for both relations and endpoints, with verification
covering duplicate detection, collision rollback, identity changes, and
validation failures.

## Decision

The canonical operation contracts are owned by `@repo/operations`.
The executor consumes those contracts and owns execution behavior. The
Store routes entity/relation/graph mutations through the executor rather
than implementing independent graph mutation logic.

## Verification

Sprint 3 was verified against the actual repository using the
repository-resident `verify-sprint3.ts` integration harness, covering:

- Relation creation, update, and deletion with rollback
- Endpoint creation, update, and deletion with rollback
- Duplicate operation rejection and rollback
- Identity-changing updates
- Collision detection and rollback
- Validation failure rollback
- Ambiguous lookup rejection
- Compiler compatibility

Repository-level verification also passed:
- `npm --workspace=web run check-types`
- `npm run build`
- Sprint 3 integration verification via `verify-sprint3.ts`

Sprint 4 was verified using `verify-sprint4.ts`, confirming:
- Backend IR compilation is deterministic
- NestJS generator produces identical output on repeated compilation
- All 5 canonical NestJS files are generated (main.ts, app.module.ts, user.module.ts, user.controller.ts, user.service.ts)
- Controller has correct @Get, @Post decorators and IR handler IDs
- POST body binding with @Body() decorator
- Generated project compiles successfully with tsc

Sprint 5 was verified using `verify-sprint5.ts`, confirming:
- End-to-end materialize → install → build → start lifecycle
- Live HTTP CRUD: POST, GET, GET/:id, PUT, DELETE
- Security: materializer rejects absolute POSIX paths

Sprint 6 was verified using `verify-sprint6.ts` (mock) and
`verify-sprint6-gemini.ts`, confirming:
- AI intent interpretation using Google Gemini translates natural
  language into Architecture Operations
- Valid intents succeed and mutate the graph atomically
- "needs_clarification" and "error" statuses produce zero mutations
- Unknown operation types throw explicit errors
- Compiler validation passes on resulting graphs

## Consequences

The Operation / Executor architecture is now proven across all mutation
domains: entities, relations, and endpoints.

Future mutation domains should reuse this architecture rather than
introducing independent mutation pathways.

The Architecture Graph schema and compiler architecture required no
changes to support the expanded mutation surfaces.

The repository now contains repeatable verification harnesses
(verify-sprint3.ts, verify-sprint4.ts, verify-sprint5.ts,
verify-sprint6.ts) that can be rerun whenever the Editing Engine or
AI integration is modified.

Entity, relation, and endpoint lifecycle support is considered complete
for Sprints 3–6.
The broader Editing Engine remains in progress because history,
undo/redo, and additional mutation domains are still outside the
completed scope.

---

# D-009 — AI Intent Translation Boundary

## Decision

AI-generated intent is separated from canonical architecture mutation through
the `@repo/intent` package.

The execution boundary is:

```
Natural Language
→ AIProvider
→ IntentResponse
→ IntentAdapter
→ Architecture Operations
→ OperationExecutor
→ Architecture Graph
```

`@repo/ai` is responsible only for AI intent generation and structural
validation.

`@repo/intent` is responsible only for deterministic translation and
sequential execution of validated intent.

`@repo/operations` remains the canonical source for operation construction.

`@repo/executor` remains the sole authority for graph mutation.

### Execution Semantics

AI-provided operation ordering is preserved exactly.

No topological sorting or semantic reordering occurs inside `@repo/intent`.

Multi-operation intents execute sequentially using local graph references.
Intermediate states are committed only after every operation succeeds.

If any operation fails, the adapter returns the original graph and executor
diagnostics, producing atomic intent-level rollback.

### Consequences

- AI cannot bypass the canonical editing pipeline.
- AI-generated IDs and metadata are never trusted.
- Operation factories remain the authority for canonical operation creation.
- The Executor remains the sole graph mutation authority.
- AI failures and executor failures remain distinguishable.
- The architecture remains provider-independent.
- Future AI providers can implement `AIProvider` without changing the editing
  engine.

# D-010 — AI Model and Graph Store Refinements (Sprint 8)

**Date:** 2026-08-27  
**Category:** Engineering / Implementation  
**Status:** Accepted

### Context

Sprint 8 refined the AI intent handling and graph storage implementation:

- `@repo/ai` updated Gemini model from `gemini-3.7-flash` to `gemini-3.6-flash`
- `@repo/intent` refined deterministic translation of validated intent
- `@repo/store` graph store continues to expose the canonical
  `applyIntent` boundary and surfaces executor/intent failures through
  its existing success/message contract
- `AIPromptBar` component adapted to new context serialization format

### Decision

The AI model was updated to `gemini-3.6-flash` for improved performance and cost-efficiency.

The `@repo/intent` package refined its deterministic translation to better preserve operation ordering and intermediate state management.

The `@repo/store` graph store continues to expose the canonical
  `applyIntent` boundary and surfaces executor/intent failures through
  its existing success/message contract, maintaining backward
  compatibility without adding a `diagnostics` field to the public API.
  If diagnostics are added to the public return type in the future, the
  public-contract change must follow the applicable RFC/ADR process and be
  recorded under the next available ADR identifier at the time the proposal
  is made. D-010 remains a historical record and must not be amended to
  document that future change.

Context serialization in `@repo/ai` was updated to return arrays of entity/field information rather than single objects, ensuring deterministic processing.

### Verification

Sprint 8 implementation was iteratively verified through:

- `@repo/ai` package tests
- repository-wide test suite
- workspace type checking
- Sprint 6 regression verification
- Sprint 7 verification
- Sprint 8 AI/context integration verification
- physical web application verification

The final presentation-ready MVP state was established after resolving
the Sprint 8 integration and type-contract issues encountered during
implementation.

### Consequences

- AI responses may differ slightly due to model change, but remain within expected behavior
- More detailed diagnostics available for intent failures
- Context serialization format changed; consumers must update accordingly
- Backward compatibility maintained for all public interfaces
- Future AI provider updates can follow the same pattern without architectural changes

---

# D-011 — History Engine and Undo/Redo (Sprint 9)

**Date:** 2026-10-13  
**Category:** Engineering / Implementation  
**Status:** Accepted

### Context

Sprints 1–8 established the canonical Architecture Operation → Executor → Validation → Commit pipeline for all mutation domains (entities, relations, endpoints, events, workflows). The Editing Engine lacked history tracking, undo, and redo capabilities.

Sprint 9 implemented a deterministic History Engine (`@repo/store/src/history.ts`) that records committed Architecture Graph states and enables undo/redo without violating the single-execution-pipeline principle.

### Decision

A `HistoryEngine` class is introduced in `@repo/store/src/history.ts` with the following characteristics:

- **Deterministic**: Records only successfully committed Architecture Graph states via `record()`
- **Atomic**: Each `record()` call clears the redo stack and enforces a maximum depth (default 50)
- **Isolated**: Uses `cloneGraph()` (structuredClone fallback to JSON) to ensure zero reference sharing between live state and history snapshots
- **Decoupled**: The engine is strictly separated from store mutation logic and validation—it only knows about `ArchitectureGraph`

The `graphStore.ts` integrates the engine via:
- `commitGraph(state, newGraph)` — called after every successful operation execution; records the new state and updates `canUndo`/`canRedo` flags
- `undo()` / `redo()` — mutate the store's graph to the previous/next recorded state
- `resetGraph(graph)` — resets the entire history to a new baseline (used for project loading)

The `HistoryToolbar` component (`apps/web/app/components/HistoryToolbar.tsx`) provides the UI for undo/redo actions.

### Verification

- Unit tests for `HistoryEngine` in `packages/store/src/__tests__/history.test.ts` covering: record, undo, redo, clear, reset, maxDepth enforcement, snapshot inspection
- Canonical mutation tests in `packages/store/src/__tests__/canonical-mutation.test.ts` verifying that all mutators (entities, relations, endpoints, events, workflows) record history
- `npm --workspace=web run check-types` passes
- `npm run build` passes
- Sprint 9 verification via `verify-sprint9.ts` (repository-resident)

### Consequences

- Undo/redo is now a first-class capability of the Editing Engine
- History is scoped to committed states only—failed/rolled-back operations leave no history entry
- The maxDepth limit prevents unbounded memory growth
- The `HistoryEngine` is pure and testable in isolation from the store
- Future collaboration features (e.g., event sourcing, distributed sync) can build on this foundation without changing the mutation pipeline
- Entity editing (Sprint 10) reuses the same history infrastructure

### Implementation Context: Snapshot vs. Operation-Level History

The implemented `HistoryEngine` records **full Architecture Graph snapshots** for each committed state (maxDepth 50). This enables deterministic undo/redo of the complete architectural state.

This differs from the conceptual **operation-level History Entry** model described in the Domain Model Specification (PART IV, Section 13), which envisions an audit log of individual Architecture Operations with metadata (timestamp, source, user, etc.). The current implementation does not persist an operation-level audit log, does not record operation metadata beyond the resulting graph state, and does not implement durable persistence of history across sessions.

The snapshot-based approach is sufficient for the current in-memory undo/redo use case. A future ADR, using the next available ADR identifier at the time the proposal is made, should address the transition to operation-level audit logging if durable history, collaboration, or compliance requirements emerge. D-011 documents the current snapshot-based implementation and does not itself authorize a change to the domain model.

---

# D-012 — Generated-Backend PostgreSQL Persistence & Relational Integration (Sprint 11)

**Date:** 2026-10-19  
**Category:** Engineering / Implementation  
**Status:** Accepted

### Context

Sprints 1–10 established the complete Editing Engine (entities, relations, endpoints, events, workflows), AI intent interpretation, History Engine, and in-memory NestJS code generation with HTTP CRUD verified against an ephemeral in-memory store. Sprint 11 introduces PostgreSQL/Prisma persistence for data stored by generated backend applications, including relational-integrity enforcement verified through isolated test databases.

### Decision

1. **Prisma Generator (`@repo/plugins/prismaGenerator.ts`)**: Rewritten as a validation-first schema generator that:
   - Emits Prisma models from Backend IR Database domain with scalar field type mapping
   - Generates bidirectional `@relation` fields for one-to-many associations with deduplication
   - Enforces referential integrity: FK must reference source PK, types must match exactly
   - Rejects unsupported relation types (many-to-many, many-to-one) and enum fields at generation time
   - Detects field name collisions between declared fields and generated relation fields
   - Produces byte-for-byte deterministic output regardless of relation declaration order

2. **NestJS Generator (`@repo/plugins/nestjsGenerator.ts`)**: Migrated from in-memory Map to Prisma ORM:
   - Generates `PrismaModule`/`PrismaService` for DI; imports `PrismaModule` in `AppModule`
   - Services are async with centralized `handleError()` mapping Prisma codes (P2002→ConflictException, P2025→NotFoundException)
   - Supports both UUID (string) and auto-increment (Int) primary keys with runtime ID parsing/validation
   - Validates required fields on create/update; preserves PK on update
   - Deterministic sorting of models, fields, routes for reproducible output
   - Generation-time validation: rejects missing PK, missing PK field, unsupported PK type

3. **Runtime Orchestrator (`@repo/runtime/src/orchestrator.ts`)**: Security-hardened test database management:
   - `validateTestDatabaseUrl()` enforces postgres(sql) protocol, loopback hosts (localhost/127.0.0.1/::1/host.docker.internal), test DB naming convention (`test`/`test_*`/`*_test`), and explicit `?schema=` parameter matching `^test_[a-zA-Z0-9_]+$` (≤63 chars)
   - `prepareDatabase()` runs `prisma db push` against isolated schema
   - `cleanupDatabase()` executes `DROP SCHEMA IF EXISTS "schema" CASCADE` via `prisma db execute`
   - E2E integration test suite (`e2e.integration.test.ts`) verifies: live HTTP CRUD, FK constraint rejection (P2003→500), persistence across process restart, proper cleanup order (child before parent)

### Verification

The following verification results were recorded for the Sprint 11
generated-backend persistence work:

- Focused Prisma and NestJS generator test suites: 20/20 tests passed in
  total. Coverage includes relation generation, primary/foreign-key
  validation, unsupported relation mappings, field collisions, required
  field handling, error mapping, and deterministic generation.
- Runtime E2E integration suite
  (`packages/runtime/src/__tests__/e2e.integration.test.ts`): 8/8 tests
  passed. Coverage includes materialization, dependency installation,
  database preparation, build, startup readiness, live HTTP CRUD,
  foreign-key integrity, restart, data persistence across restart, and cleanup.
- Docker build-check image:
  `docker build -f Dockerfile.build -t backend-os-build-check .`
  completed successfully.
- Docker-invoked type-check:
  `docker run --rm --entrypoint pnpm backend-os-build-check check-types`
  exited successfully. The configured Turborepo task graph executed the
  `@repo/ui` and `web` type-check tasks only. This result must not be
  represented as a successful type-check of every monorepo package.

These results verify the stated scopes only. The exact test invocation should
be retained with the corresponding test log; do not infer or invent a
command that is not present in the recorded evidence.

### Consequences

**Scope Boundary**

This decision applies to PostgreSQL/Prisma persistence inside generated
backend applications. It does not implement persistence or restoration of
Backend OS Projects, Project Configuration, Architecture Graphs, UI state,
or project metadata. Those are platform-side project lifecycle concerns and
must be implemented against the canonical Project and Architecture Graph
contracts. D-012 does not resolve the stable-identity contract gap described
in the Master Context.

- Generated backend applications now target PostgreSQL via Prisma ORM with
  relational-integrity behavior verified by the Sprint 11 test suite.
- Prisma Generator establishes validation-first pattern for future database generators (Drizzle, TypeORM, SQLAlchemy, Entity Framework)
- Runtime Orchestrator provides secure, schema-isolated test infrastructure for CI/CD
- NestJS Generator error handling maps Prisma codes to semantic HTTP exceptions
- Deterministic byte-for-byte generator output enables reliable caching and incremental builds
- Architecture Graph schema and compiler architecture required no changes — persistence is a generation concern
- The `@repo/plugins` package now exports both generators with comprehensive test coverage