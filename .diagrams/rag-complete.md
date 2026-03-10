# RAG Complete Guide (MVP First)

This document defines the target RAG + writing pipeline for Code Lens, prioritizing a minimal viable implementation that produces useful markdown documentation first.

## Scope and implementation strategy

The project should be delivered in two layers:

1. MVP (required): produce consistent, repository-specific markdown documentation.
2. Phase 2+ (optional): improve retrieval quality and add diagram-oriented capabilities.

Important decisions:

- Call/dependency graphs and automatic diagrams are not required for MVP documentation quality.
- Good documentation is achievable with semantic chunks + embeddings + retrieval + writer.
- Tree-sitter AST analysis **is used in the MVP only to improve semantic chunking**, not to build graphs or perform deep static analysis.

## Target architecture

```text
repo (already preprocessed by server)
  -> file discovery
  -> classification + language detection
  -> loader
  -> AST-aware chunking
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

- code: **AST-aware semantic chunking using Tree-sitter when available**
- code fallback: text chunking with safe size + overlap
- markdown: split by headers when possible
- csv: row-group chunks
- text: fixed-size chunks with overlap

AST policy in MVP:

- Tree-sitter is used **only to detect semantic boundaries in code**
- extract chunks based on high-level nodes when possible (e.g. class, function, method)
- no dependency graph or call graph extraction in MVP
- if AST parsing fails or produces no usable nodes, fallback to textual chunking

Typical AST chunk targets (examples):

- classes
- functions
- methods
- structs
- interfaces

Oversized AST nodes should be subdivided with text chunking.

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

Recommended optional metadata:

```json
{
  "chunk_index": 3,
  "total_chunks": 12,
  "file_hash": "sha256"
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

Recommended retrieval parameters:

```
top_k ≈ 20
```

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

Example output structure:

```
/wiki_output/{repo_id}/
  01-overview.md
  02-architecture.md
  03-components.md
  04-api.md
```

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

1. Improved AST semantic chunking with better symbol coverage.
2. Better ranking using `relevant_files` weighting.
3. Token budget optimization and chunk compression.
4. Controlled parallel section generation.
5. Reindex by commit and idempotency.

## Optional advanced phase (diagram-oriented)

These are explicitly optional for documentation MVP:

1. call graph extraction
2. dependency graph extraction
3. automatic Mermaid/UML generation

These features are primarily useful for:

- architecture diagrams
- dependency visualization
- code navigation tools

## Definition of done (MVP)

- A `/docs-gen` request generates real markdown files.
- Retrieval uses Qdrant with strict `repo_id` isolation.
- Output is repository-specific and grounded in retrieved context.
- Logs are traceable by `repo_id` across planner, indexation, retrieval, and writer.
- Code files benefit from AST-aware semantic chunking when parsers are available.
