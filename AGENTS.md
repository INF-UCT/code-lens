# AGENTS.md — Code Lens

## Project Overview

Code Lens is a self-hosted, AI-powered documentation generator that integrates GitHub
Actions with an on-premises LLM stack. When a developer pushes to a repository, a
composite GitHub Action fires and sends repository metadata (URL, branch, commit SHA)
to a Rust/Axum API server authenticated by a JWT token generated once per repository
via the CLI tool.

The Rust server clones the exact commit, preprocesses the repository (removing build
artifacts, binaries, lock files, and oversized files), generates file-tree
representations, and dispatches the work to a Node.js wiki service that runs a
three-stage LangChain planning pipeline against a local vLLM instance (DeepSeek-R1 /
Qwen3). The pipeline selects representative files, writes a project summary, proposes
a set of documentation sections, and (once the writer agent is complete) outputs one
Markdown file per section to `/wiki_output/{repo_id}/`.

Users authenticate against an institutional LDAP server. The entire stack runs in
Docker Compose behind an Nginx reverse proxy and is designed for enterprise/on-premises
environments.

### End-to-End Flow

```
Git push
  → GitHub Action  POST /api/repositories  (Bearer JWT)
  → Nginx :80      strip /api/ prefix       proxy → Rust server :8000
  → Rust server    validate JWT token        upsert repository row
                   git2::clone               checkout exact commit SHA
                   preprocessor              remove ignored/oversized files
                   tokio::try_join!
                     ├── SMTP email          "Documentation started" to owner
                     └── POST localhost:3000/docs-gen  (wiki service)
  → Wiki service   Generate docs (still on development)
  → Output         /wiki_output/{repo_id}/01-overview.md  ...
```

---

## Repository Structure

```
code-lens/
├── apps/
│   ├── server/          Rust/Axum REST API — auth, token management, repo orchestration
│   ├── wiki/            Node.js/TypeScript — LangChain + vLLM documentation generator
│   ├── cli/             Node.js/TypeScript — interactive terminal tool for onboarding
│   └── client/          Frontend viewer (empty placeholder, not yet implemented)
├── config/              Nginx reverse-proxy configuration
├── .github/
│   ├── actions/doc-generator/  Composite GitHub Action shipped to end-user repos
│   └── workflows/              CI (fmt/clippy/lint) and CD (Docker push) pipelines
├── .diagrams/           Mermaid architecture diagrams and v1 design notes
├── compose.yml          Docker Compose — all four services + shared volume
├── Makefile             Developer task runner (wraps Docker, Cargo, npm)
└── Cargo.toml           Cargo workspace root (covers apps/server only)
```

---

## Commands

See the [Makefile](Makefile) for all available commands.

---

## TypeScript Code Style

See the [prettier configuration](.prettierrc.json) for formatting rules. 
See the `tsconfig.json` files in each Node.js app for TypeScript rules.

### Naming Conventions

| Construct                          | Convention             | Example                               |
| ---------------------------------- | ---------------------- | ------------------------------------- |
| Variables / functions / parameters | `camelCase`            | `repoPath`, `generateDocs`            |
| Classes / interfaces / types       | `PascalCase`           | `PlannerAgent`, `DocGenerationInput`  |
| Constants / enum-like keys         | `SCREAMING_SNAKE_CASE` | `DEEPSEEK`, `QWEN_3_4B`               |
| Source files (multi-word)          | dot notation           | `llm.factory.ts`, `vllm.service.ts`   |
| Source files (single-word)         | plain                  | `planner.ts`, `env.ts`                |
| Schema files                       | `.schema.ts` suffix    | `api.schema.ts`, `sections.schema.ts` |

### Types

- **Zod is the source of truth** for all validated data shapes. Derive types from
  schemas: `type Foo = z.infer<typeof FooSchema>`. Do not write parallel interfaces.
- Prefer interfaces for plain data shapes, type aliases for unions and mapped types.
- Use generics over `any`. Generic wrappers like `Response<T, E>` and `AppResult<T>`
  are preferred for consistent API surface.

---
