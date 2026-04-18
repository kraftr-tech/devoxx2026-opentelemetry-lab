# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenTelemetry hands-on workshop built around "Atelier", an e-commerce application composed of 6 microservices. The goal is to instrument these services with OpenTelemetry.

## Architecture

```
UI (React/Vite :3000)
├── /api/products  → products-service (:8002)  [Flask/SQLite]
├── /api/users     → users-service (:8001)     [Flask/SQLite]
└── /api/billing   → billing-service (:8004)   [Flask/SQLite]
                       ├── products-service     [HTTP - stock validation & update]
                       └── payment-service (:8003) [Flask/SQLite]
                              └── bank-service (:50051) [Go/gRPC]
```

**Communication patterns:**
- UI → backends: HTTP REST via Vite dev server proxy (routes defined in `ui/vite.config.ts`)
- billing-service → products-service, payment-service, users-service: HTTP REST
- payment-service → bank-service: gRPC (proto contract at `proto/transaction.proto`)

**Service responsibilities:**
- **users-service**: authentication, user management, shopping cart
- **products-service**: product catalog, stock management
- **billing-service**: checkout orchestration (validates stock, computes totals with tax/shipping, processes payment, creates orders), order storage
- **payment-service**: payment processing, calls bank-service via gRPC
- **bank-service**: simulates bank transaction processing (100-500ms delay, ~10% decline rate)

**Python service structure** (users, products, payment, billing):
```
app.py      → Handlers (Flask routes, input validation, HTTP responses)
service.py  → Business logic (orchestration, no Flask imports)
db.py       → Database layer (SQLite connection, queries, schema init)
```

**Go service structure** (bank):
```
main.go     → Entry point (gRPC server startup)
handler.go  → gRPC handler (request/response mapping)
service.go  → Business logic (transaction processing)
```

## Commands

### Prerequisites
```bash
mise install          # Installs go, node, protoc, protoc-gen-go, protoc-gen-go-grpc
```

### Run the full stack
```bash
docker compose up --build
```
App available at http://localhost:3000

### Generate protobuf stubs for bank-service
```bash
task proto:bank
```
Python stubs for payment-service are generated at Docker build time in its Dockerfile.

### UI development
```bash
cd ui && npm install
cd ui && npm run dev      # Dev server
cd ui && npm run build    # Production build
cd ui && npm run lint     # TypeScript check (tsc --noEmit)
```

## Key Details

- All Python services run with **gunicorn** (not Flask dev server)
- All Python services use **SQLite** with persistent Docker volumes
- The UI is a single-file React app (`ui/src/App.tsx`) with all screens and components
- Two user roles: **admin** (backoffice only) and **client** (shop, cart, checkout)
- Seed data is auto-created on first run (2 users: `admin@kraftr.tech`/`admin123`, `john.doe@kraftr.tech`/`client123`)
- The billing `/api/billing` proxy rewrites to `/` (unlike other proxies that rewrite `/api` to `/`)


<!-- CLAVIX:START -->
## Clavix Integration

This project uses Clavix for prompt improvement and PRD generation. The following slash commands are available:

> **Command Format:** Commands shown with colon (`:`) format. Some tools use hyphen (`-`): Claude Code uses `/clavix:improve`, Cursor uses `/clavix-improve`. Your tool autocompletes the correct format.

### Prompt Optimization

#### /clavix:improve [prompt]
Optimize prompts with smart depth auto-selection. Clavix analyzes your prompt quality and automatically selects the appropriate depth (standard or comprehensive). Use for all prompt optimization needs.

### PRD & Planning

#### /clavix:prd
Launch the PRD generation workflow. Clavix will guide you through strategic questions and generate both a comprehensive PRD and a quick-reference version optimized for AI consumption.

#### /clavix:plan
Generate an optimized implementation task breakdown from your PRD. Creates a phased task plan with dependencies and priorities.

#### /clavix:implement
Execute tasks or prompts with AI assistance. Auto-detects source: tasks.md (from PRD workflow) or prompts/ (from improve workflow). Supports automatic git commits and progress tracking.

Use `--latest` to implement most recent prompt, `--tasks` to force task mode.

### Session Management

#### /clavix:start
Enter conversational mode for iterative prompt development. Discuss your requirements naturally, and later use `/clavix:summarize` to extract an optimized prompt.

#### /clavix:summarize
Analyze the current conversation and extract key requirements into a structured prompt and mini-PRD.

### Refinement

#### /clavix:refine
Refine existing PRD or prompt through continued discussion. Detects available PRDs and saved prompts, then guides you through updating them with tracked changes.

### Agentic Utilities

These utilities provide structured workflows for common tasks. Invoke them using the slash commands below:

- **Verify** (`/clavix:verify`): Check implementation against PRD requirements. Runs automated validation and generates pass/fail reports.
- **Archive** (`/clavix:archive`): Archive completed work. Moves finished PRDs and outputs to archive for future reference.

**When to use which mode:**
- **Improve mode** (`/clavix:improve`): Smart prompt optimization with auto-depth selection
- **PRD mode** (`/clavix:prd`): Strategic planning with architecture and business impact

**Recommended Workflow:**
1. Start with `/clavix:prd` or `/clavix:start` for complex features
2. Refine requirements with `/clavix:refine` as needed
3. Generate tasks with `/clavix:plan`
4. Implement with `/clavix:implement`
5. Verify with `/clavix:verify`
6. Archive when complete with `/clavix:archive`

**Pro tip**: Start complex features with `/clavix:prd` or `/clavix:start` to ensure clear requirements before implementation.
<!-- CLAVIX:END -->
