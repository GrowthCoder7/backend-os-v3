# Backend OS V3 — Sprint 12 P12-01 Phase 0 Report

**Status:** Documentation-based assessment; repository verification pending  
**Decision:** Design exploration may continue. The persistence interface is not frozen and durable-persistence implementation is blocked pending source verification and formal resolution of the stable-identity contract discrepancy.

## 1. Evidence Classifications

### Facts established by the canonical documents

- Architecture Version 1.0 is frozen. Architectural redesign requires the formal governance process.
- Project lifecycle capabilities include create, list, open, save, rename, delete, and supported import/export.
- Durable persistence/restoration of Backend OS Projects and Architecture Graphs is a documented gap. This is separate from Sprint 11 PostgreSQL/Prisma persistence for data stored by generated backend applications.
- The Domain Model requires stable immutable identity and lossless serialization of the Architecture Graph.
- The History Engine is described as snapshot-based (maximum depth 50), with store/history behavior associated with `commitGraph()` and `resetGraph()`.
- Sprint 12 excludes deployment-provider integration.
- Build, test, and type-check verification must be run through Docker.
- The canonical Master Context records a stable-identity discrepancy as a blocker for durable project persistence.

These statements are derived from the supplied documents, not independently rechecked against source code in this phase.

### Assumptions and inferences — not verified

- The Architecture Graph may currently be initialized from volatile in-memory state; the physical initialization and hydration path has not been inspected.
- The application may not have a persistence adapter; existing source files and dependencies have not been inspected to confirm its absence.
- The runtime `ArchitectureGraph` type may differ from the conceptual `Nodes[]`/`Edges[]` serialization description.
- The graph version may or may not increment for every committed mutation; it must not be used for concurrency decisions until the implementation is inspected.
- The current lookup mechanisms for entities, relationships, endpoints, events, and workflows have not been physically verified.

### Source-level items still pending

1. Exact definitions and exports for Project, Project Configuration, Architecture Graph, metadata, diagnostics, and schema/version types under `packages/types`.
2. Actual `graphStore.ts` initialization, canonical mutations, commit flow, project activation, and `resetGraph()` semantics.
3. Actual snapshot cloning and history reset/record behavior in `packages/store/src/history.ts`.
4. Existing project-level UI controls and routes in `apps/web/app`.
5. Existing serialization utilities, browser storage adapters, import/export code, and relevant dependencies.
6. Actual identity and reference representation in the source types and mutation operations.

No `.ts` or `.tsx` files have been inspected for this report. Those items remain unverified; no repository inspection or test execution is claimed.

## 2. Contract Status

The public persistence contract must not be frozen from this report. In particular, the serialized envelope depends on the actual canonical type definitions and on the formal identity decision. The contract below is a design checklist, not an implementation-ready exported interface.

### Required lifecycle operations

- Create a new project without overwriting an existing project ID.
- List project metadata without loading or mutating all active editor state unnecessarily.
- Open a project after payload/schema validation, then activate it atomically.
- Update an existing project through an explicit update operation.
- Rename without changing stable project identity.
- Delete only the selected project and define behavior when it is active.
- Import/export using explicit validation and ID-conflict policy.

### Required typed outcomes

The final contract must distinguish at least:

- Success
- Duplicate identity/conflict
- Project not found
- Structural/semantic validation failure
- Unsupported serialization/schema version
- Storage failure
- Import conflict or remapping failure

The precise TypeScript union must be finalized after source-contract inspection. A result union describes outcomes but does not itself guarantee atomic writes.

### Atomic-save requirement

A failed create/update must not leave a partial project or destroy the previous valid persisted revision. The chosen provider must implement this requirement explicitly, for example with an IndexedDB transaction that commits the complete project envelope as one transaction. Concurrent or out-of-order writes must not silently replace a newer revision with an older captured snapshot.

### Import identity policy

Import must have an explicit conflict policy. If the identity already exists, the caller must either receive a conflict or invoke a reviewed remapping procedure. Remapping must update every relevant internal reference without loss and must comply with the approved identity contract. It must not be implemented before identity semantics are resolved.

## 3. Serialization Envelope — Not Frozen

The canonical domain model describes Project ownership of the Architecture Graph and Project Configuration. The exact TypeScript shape and reference arrangement have not been inspected. Therefore, no duplicate root-level graph/configuration copies should be introduced until the physical types are confirmed.

The final serialized envelope must preserve the canonical project payload exactly once, plus whatever explicit envelope metadata is required for format identification and compatibility. The contract must distinguish:

- Project's logical version
- Serialization/envelope schema version
- Architecture Graph structural version
- Compiler version metadata, where required by the canonical contract
- Creation/update timestamps and project metadata

Do not treat these versions as interchangeable. Serialization must preserve identifiers, references, metadata, and structure without loss. Any migration policy must be explicit and versioned.

## 4. Proposed Save-State and Concurrency Contract

The UI may use these states:

- `IDLE`
- `UNSAVED_CHANGES`
- `SAVING`
- `SAVED`
- `ERROR`

The implementation must track a captured immutable revision/snapshot for every save. Do not assume `graph.version` is reliable until source inspection confirms mutation semantics.

| Event | Required behavior |
|---|---|
| Canonical graph mutation commits | Mark the current project dirty and queue/debounce auto-save if enabled. |
| Save starts | Capture one immutable project revision and save that revision. |
| New edits occur during save | Keep the current project dirty; allow the in-flight snapshot to finish. |
| Save succeeds with no newer edits | Mark that captured revision saved; display `SAVED` briefly, then return to `IDLE`. |
| Save succeeds with newer edits present | Keep `UNSAVED_CHANGES` and queue the newest revision. |
| Save fails | Show a diagnostic, retain unsaved state, and preserve the previous valid persisted revision. |
| User retries | Capture and submit the newest unsaved revision. |

An explicit Save should bypass debounce. Auto-save behavior and the debounce interval must be agreed and tested. A project must not appear clean if its newest revision has not been persisted.

## 5. Restoration Transaction

1. Fetch the candidate serialized project without changing active state.
2. Validate envelope shape and serialization version.
3. Check schema compatibility and required identity/reference invariants.
4. Validate the candidate Architecture Graph using the appropriate graph validator.
5. If any check fails, return a structured diagnostic and preserve the active project, graph, and history exactly as they were.
6. On success, activate the project identity and graph through one controlled store transition.
7. Establish the history baseline only after successful activation, using the actual verified store/history API.
8. Resume all later architecture edits through the canonical Architecture Operation pipeline.

The UI must not observe a partially activated project or mismatched graph/history state. The exact `resetGraph()` semantics must be source-verified before this contract is implemented.

## 6. Proposed Acceptance-Test Matrix — Not Yet Executed

All verification commands must run through Docker. No test in this matrix has been executed as part of this report.

| Scenario | Required assertion | Status |
|---|---|---|
| Create/list/open/update/rename/delete | Correct outcomes and metadata; no unrelated project changes | Not executed |
| Duplicate ID | Create/import conflict does not overwrite existing project | Not executed |
| Atomic save failure | Failed write leaves the prior persisted payload intact | Not executed |
| Complete round-trip | Entities, fields, relationships, endpoints, graph metadata/version, and project metadata restored without loss | Not executed |
| Refresh/new session | Saved project is available after refresh/reopen | Not executed |
| Project isolation | Mutating/deleting B leaves A unchanged | Not executed |
| Concurrent saves | Older captured revision cannot silently overwrite a newer revision | Not executed |
| Edit during save | New revision remains dirty and is queued for persistence | Not executed |
| Corrupt/incompatible payload | Clear error; active project and history remain untouched | Not executed |
| Import identity conflict | Explicit fail/remap policy; all references remain valid | Not executed |
| History baseline | Opened graph begins as a clean baseline; next edit supports undo/redo | Not executed |
| Save-state transitions | IDLE → dirty → SAVING → correct success/error state | Not executed |
| Storage unavailable | Visible diagnostic, unsaved state retained, previous save preserved | Not executed |

## 7. Formal Blocker and Next Gate

**Stable-identity contract blocker:** the canonical Master Context records a discrepancy between identity requirements and implementation lookup keys. The specific current source behavior has not been independently confirmed in this phase. Before durable persistence implementation begins, inspect the actual types and mutation paths, record findings, and resolve any real discrepancy through the accepted formal decision process. Do not invent a new identity scheme, weaken canonical domain requirements, or infer a repository fact from documentation alone.

**Next gate:** source-level contract inspection, formal resolution of the identity dependency, and approval of the final serialized envelope/repository interface. Until then, this report authorizes design clarification only; it does not authorize durable-persistence implementation.
