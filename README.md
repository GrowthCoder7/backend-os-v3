# Backend OS

**Backend OS** is an architecture-driven backend compiler platform that transforms high-level system architecture into production-ready backend applications through a deterministic compilation pipeline.

Unlike conventional backend frameworks, Backend OS treats software architecture as the primary executable specification. Developers describe a backend using a framework-independent **Architecture Graph** that captures the logical structure of the system—including entities, relationships, endpoints, workflows, events, and project configuration. This graph becomes the single source of truth for the entire platform.

Every subsequent artifact—including validation results, semantic models, compiler outputs, generated source code, database schemas, API specifications, and documentation—is deterministically derived from this architecture.

## Core Philosophy

Backend OS is a **compiler platform** designed specifically for backend software engineering. It provides an end-to-end environment for designing, validating, compiling, inspecting, and generating backend systems while maintaining complete separation between architectural intent and implementation technology.

The platform consists of six major capabilities:
- **Architecture Modeling** - Design backend systems using the Architecture Graph
- **Architecture Validation** - Verify structural correctness and consistency
- **Semantic Analysis** - Resolve architectural meaning and dependencies
- **Compiler Pipeline** - Transform architecture into Backend Intermediate Representation (Backend IR)
- **Backend IR** - The canonical compiled representation
- **Code Generation Framework** - Generate framework-specific implementations (e.g., NestJS)

## Quick Start

```sh
# Install dependencies
cd backend-os-v3
pnpm install

# Build all packages
pnpm build

# Run development server
pnpm dev
```

## Architecture

The compiler pipeline flows through these stages:

```
Architecture Graph
      │
      ▼
Validation Engine
      │
      ▼
Semantic Analysis
      │
      ▼
Compiler Pipeline
      │
      ▼
Backend IR
      │
      ▼
Code Generation Framework
      │
      ▼
Generated Backend Application
```

## Key Concepts

- **Architecture Graph** - The single source of truth for backend design
- **Architecture Operations** - All modifications represented as structured operations
- **Operation Executor** - The sole authority for graph mutation
- **Backend IR** - Compiler output consumed by generators
- **Deterministic Compilation** - Same architecture always produces identical results
- **Framework Independence** - Architecture remains independent of implementation technologies

## Repository Structure

```
backend-os-v3/
├── apps/              # Applications (web interface, docs)
├── packages/          # Packages (types, store, validation, compiler, generators, etc.)
├── docs/              # Documentation (constitution, architecture, domain models, decisions)
├── verify-sprint*.ts  # Sprint verification harnesses
├── package.json       # Root package configuration
└── turbo.json         # Turborepo configuration
```

## Documentation

The project is governed by these canonical documents (in order of authority):

1. `00_PROJECT_CONSTITUTION.md` - Vision, philosophy, governance, engineering values
2. `01_ARCHITECTURE_SPECIFICATION.md` - System architecture, compiler pipeline, subsystem responsibilities
3. `02_DOMAIN_MODEL_SPECIFICATION.md` - Canonical domain objects and platform vocabulary
4. `03_BACKEND_OS_MASTER_CONTEXT.md` - Current engineering context, methodology, implementation status, roadmap
5. `DECISIONS.md` - Accepted engineering and implementation decisions (ADRs)

## Development

Backend OS follows an architecture-first engineering process. Contributors should approach development with the mindset of building infrastructure rather than building an application. Infrastructure is expected to remain stable, evolve predictably, expose reliable contracts, support extension, and outlive individual implementation decisions.

Every line of code should strengthen the platform rather than merely satisfy an immediate requirement.

## License

MIT