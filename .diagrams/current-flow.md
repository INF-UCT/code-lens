# Current Flow (Implemented State)

This document explains the current, real behavior of the Code Lens wiki pipeline based on the code in `apps/server` and `apps/wiki`.

## End-to-end request flow

```text
GitHub Action
  -> POST /api/repositories (Nginx -> Rust server)
  -> Rust server validates token, clones exact commit, preprocesses repo
  -> Rust server calls wiki service POST /docs-gen
  -> Wiki service validates API key and payload
  -> PlannerAgent runs
  -> RAG indexation starts (partial)
  -> Endpoint responds success message
```

## What is implemented and working

### Rust orchestration (`apps/server`)

- Receives repository metadata through `POST /repositories`.
- Validates repository token using interceptor.
- Stores repository metadata in Postgres.
- Clones exact commit SHA with `git2`.
- Preprocesses cloned repository:
  - removes ignored files and folders (`config/ignore-patterns`)
  - validates max file size
- Generates a repository tree string using `rg --files`.
- Triggers two async actions:
  - sends start notification email
  - requests docs generation in wiki service (`/docs-gen`)

### Wiki API baseline (`apps/wiki`)

- Exposes `POST /docs-gen` in Hono.
- Validates API key with `Authorization: Bearer <WIKI_SERVICE_API_KEY>`.
- Validates payload with Zod:
  - `repoId` (uuid)
  - `repoPath` (non-empty)
  - `repoTree` (non-empty)
- Runs `PlannerAgent`.
- Starts `rag.newIndexation(repoPath)`.

## What is partially implemented

### Planner integration

- `PlannerAgent` exists and returns a typed `Result<WikiStructure>`.
- The endpoint logs planner output, but does not continue into section-level generation.

### RAG indexation skeleton

- File discovery and classification are implemented.
- Loader selection exists (`csv`, `markdown`, `text`, `code`).
- AST loader parses source files using Tree-sitter.

Current gap:

- Parsed AST is not converted into chunks/documents yet (`ASTLoader.load()` returns empty array).
- Loaded documents are logged but not persisted.

## What is missing to reach functional docs generation

1. Qdrant persistence

- No upsert/index operation is executed today.
- `QdrantService` builds a vector store connection, but indexation flow does not write vectors.

2. Retrieval per section

- There is no retrieval service that queries by section + `repo_id` filter.

3. Writer stage

- Writer agent files are empty and not integrated:
  - `apps/wiki/src/agents/writer/agent.ts`
  - `apps/wiki/src/agents/writer/schemas.ts`

4. Markdown output persistence

- No files are written yet to `/wiki_output/{repo_id}`.

5. Final endpoint result

- `/docs-gen` currently returns success without real section generation metrics.

## Practical status summary

- The infrastructure and orchestration are in place.
- The pipeline currently reaches planner and a partial RAG stage.
- It is not yet an end-to-end documentation generator because retrieval, writer, and markdown persistence are still pending.

## MVP completion checklist

- [ ] Ensure planner result is validated and consumed as `Result`.
- [ ] Implement minimal indexation persistence into Qdrant.
- [ ] Implement retrieval per section with mandatory `repo_id` filter.
- [ ] Implement writer agent and section generation loop.
- [ ] Write section markdown files to `/wiki_output/{repo_id}`.
- [ ] Return final stats from `/docs-gen` (`sections_total`, `sections_written`, `output_dir`).
