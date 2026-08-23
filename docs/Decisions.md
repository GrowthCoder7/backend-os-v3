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