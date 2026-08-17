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