# RAG Complete Guide (MVP First)

This document defines the target RAG + writing pipeline for Code Lens, prioritizing a minimal viable implementation that produces useful markdown documentation first.

## Scope and implementation strategy

The project should be delivered in two layers:

1. MVP (required): produce consistent, repository-specific markdown documentation.
2. Phase 2+ (optional): improve retrieval quality and add diagram-oriented capabilities.

Important decision:

- Call/dependency graphs and automatic diagrams are not required for MVP documentation quality.
- Good documentation is achievable with semantic chunks + embeddings + retrieval + writer.

## Target architecture

```text
repo (already preprocessed by server)
  -> file discovery
  -> classification + language detection
  -> loader
  -> chunking
  -> embeddings
  -> Qdrant upsert (single collection)
  -> retrieval by section (repo_id filter)
  -> writer per section
  -> /wiki_output/{repo_id}/NN-section.md
```

## MVP pipeline (must implement)

### 1) Input contract (`POST /docs-gen`)

Required payload:

```json
{
  "repoId": "uuid",
  "repoPath": "/app/repos/<repo>",
  "repoTree": "path/a.ts\npath/b.md\n..."
}
```

Required behavior:

- validate auth and DTO
- run planner
- index repo chunks in Qdrant
- for each planner section: retrieve context + run writer
- persist markdown files
- return generation stats

### 2) Discovery and classification

Input source priority:

1. `repoTree` from request
2. filesystem fallback in `repoPath`

Minimum content kinds:

- `code`
- `markdown`
- `csv`
- `text`

Minimum language detection for code:

- `ts`, `tsx`, `js`, `jsx`, `py`, `go`, `rs`, `java`, `c`, `cpp`

### 3) Loader and chunking

MVP chunking policy:

- code: text chunking with safe size + overlap (AST symbols optional in MVP)
- markdown: split by headers when possible
- csv: row-group chunks
- text/config: fixed-size chunks with overlap

AST policy in MVP:

- keep AST parsing as a non-blocking enhancement
- if AST extraction fails or is incomplete, fallback to textual chunking

### 4) Document metadata

Each chunk must include at least:

```json
{
  "repo_id": "uuid",
  "file_path": "src/module.ts",
  "file_kind": "code",
  "language": "typescript",
  "chunk_type": "text|symbol",
  "start_line": 10,
  "end_line": 42,
  "pipeline_version": "v1"
}
```

### 5) Embeddings and Qdrant

Rules:

- use one shared collection (recommended: `wiki_chunks`)
- upsert all chunk vectors with metadata
- every query must include `repo_id` filter

Base filter contract:

```json
{
  "must": [
    { "key": "repo_id", "match": { "value": "<repo-id>" } }
  ]
}
```

### 6) Retrieval per section

For each planned section/page, build query from:

- section title
- section description
- relevant files (if present)

Quality rules:

- remove duplicate chunks
- keep diversity across source files
- trim context to model limits
- fallback to direct read of `relevant_files` if retrieval is empty

### 7) Writer and output files

Writer input should include:

- `repoId`
- `sectionTitle`
- `sectionDescription`
- `contextText`
- `sourceFiles`
- optional `projectSummary`

Output rules:

- one file per section
- path: `/wiki_output/{repo_id}/NN-section-slug.md`
- stable 2-digit order prefix (`01`, `02`, ...)
- UTF-8 markdown

### 8) Endpoint output

Recommended response:

```json
{
  "repo_id": "uuid",
  "message": "Documentation generated successfully",
  "sections_total": 8,
  "sections_written": 8,
  "sections_failed": 0,
  "output_dir": "/wiki_output/uuid"
}
```

## Phase 2 improvements (after MVP)

1. AST semantic chunking by symbol (`class`, `function`, `method`).
2. Better ranking using `relevant_files` weighting.
3. Token budget optimization and chunk compression.
4. Controlled parallel section generation.
5. Reindex by commit and idempotency.

## Optional advanced phase (diagram-oriented)

These are explicitly optional for documentation MVP:

1. call graph extraction
2. dependency graph extraction
3. automatic Mermaid/UML generation

## Definition of done (MVP)

- A `/docs-gen` request generates real markdown files.
- Retrieval uses Qdrant with strict `repo_id` isolation.
- Output is repository-specific and grounded in retrieved context.
- Logs are traceable by `repo_id` across planner, indexation, retrieval, and writer.
