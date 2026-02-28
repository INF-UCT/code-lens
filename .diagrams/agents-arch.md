# Arquitectura de Agentes - Code Lens

## Flujo General

```
[GitHub Action] → [Rust Server] → [Wiki Service (4 Agentes)] → [Output]
                                                     ↓
                                              wiki_output/
```

## Explicación del Flujo (en palabras)

El proceso de generación de documentación comienza cuando un desarrollador hace push a su repositorio. Un GitHub Action dispara una petición al servidor Rust con los metadatos del repositorio (URL, branch, commit SHA). El servidor Rust se encarga de clonar el repositorio en la versión exacta del commit, preprocessing eliminar archivos de build, binarios y archivos demasiado grandes, y generar una representación plana del árbol de archivos.

Con el árbol de archivos disponible, entra en acción el primer agente: **ExplorerAgent**. Su misión es entender "de qué va" el proyecto. Recibe el árbol plano y el path del repositorio, usa MCP filesystem para navegar y leer archivos relevantes, e identifica hasta 10 archivos clave basándose en su propósito (entrypoints, documentación, migraciones SQL, etc.). Como resultado, genera un overview de máximo 150 palabras y detecta las tecnologías usadas.

El segundo agente es **PlannerAgent**. Recibe el output del Explorer (overview, keyFiles, technologies) junto con el árbol completo. Tiene acceso a MCP filesystem para leer archivos y planificar mejor las secciones. Analiza todo junto y propone entre 5 y 8 secciones de documentación, cada una con título, descripción y archivos asignados. Este paso es crucial porque decide la estructura de la documentación antes de escribir nada.

El tercer agente es **WriterAgent**. Este recibe todo: el árbol, el overview del Explorer, y las secciones planificadas. Para cada sección, lee los archivos asignados y también detecta imports directos para leer archivos adyacentes si es necesario. Escribe el contenido en Markdown con un límite de ~800 tokens por sección, siguiendo el formato de referencias de código especificado. Guarda cada sección como un archivo MD separado.

El cuarto agente es **CheckerAgent**. Compara las secciones que se planificaron vs las que realmente se generaron, calcula el porcentaje de coverage, y escribe un breve diagnóstico en `checker.md`. Este diagnóstico sirve para que el usuario final sepa si la documentación está completa o si hay problemas.

## Diagrama de Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WIKI SERVICE PIPELINE                              │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
     │   Explorer   │────▶│   Planner    │────▶│    Writer    │────▶│   Checker    │
     │    Agent    │     │    Agent     │     │    Agent     │     │    Agent     │
     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
           │                     │                     │                     │
           ▼                     ▼                     ▼                     ▼
    ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
    │ Explorer    │       │ Planner     │       │ Writer      │       │ Checker     │
    │ Output      │       │ Output      │       │ Output      │       │ Output      │
    │             │       │             │       │             │       │             │
    │ - overview │       │ - sections  │       │ - files[]   │       │ - diagnosis │
    │ - keyFiles │       │   (5-8)     │       │   (MD)      │       │ - coverage  │
    │ - techs    │       │             │       │             │       │             │
    └─────────────┘       └─────────────┘       └─────────────┘       └─────────────┘
```

## Agentes

### 1. ExplorerAgent

**Propósito**: Analizar el repositorio y detectar archivos clave + generar overview.

| Campo | Descripción |
|-------|-------------|
| **Input** | `flat_tree` (string), `repo_path` (string) |
| **Output** | `ExplorerOutput` |

**Proceso**:
1. Recibe el árbol plano de archivos
2. Usa MCP filesystem para navegar y leer archivos
3. Identifica hasta 10 archivos clave basándose en propósito (no en tecnología)
4. Genera resumen de ≤150 palabras explicando "de qué va" el proyecto
5. Detecta tecnologías usadas

**ExplorerOutput Schema**:
```typescript
interface KeyFile {
  path: string
  reason: string    // Por qué es importante
}

interface ExplorerOutput {
  overview: string        // ≤150 palabras
  keyFiles: KeyFile[]    // 8-10 archivos
  technologies: string[] // ["React", "PostgreSQL", etc.]
}
```

**Prompts**:
- `explorer/detect-keyfiles` - Identificar archivos importantes del tree
- `explorer/summarize` - Generar overview

---

### 2. PlannerAgent

**Propósito**: Crear estructura de documentación basada en análisis del Explorer.

| Campo | Descripción |
|-------|-------------|
| **Input** | `ExplorerOutput`, `flat_tree`, `repo_path` |
| **Output** | `PlannerOutput` |

**Proceso**:
1. Recibe output del Explorer (overview + keyFiles + technologies)
2. Tiene acceso a MCP filesystem para leer archivos y planificar mejor
3. Analiza tree + keyFiles + overview
4. Genera entre 5 y 8 secciones de documentación
5. Cada sección contiene: título, descripción, archivos asignados

**PlannerOutput Schema**:
```typescript
interface Section {
  title: string
  description: string     // 1-2 oraciones
  keyFiles: string[]     // Paths asignados a esta sección
}

interface PlannerOutput {
  sections: Section[]     // 5-8 secciones
}
```

**Prompts**:
- `planner/create-sections` - Generar estructura de documentación

---

### 3. WriterAgent

**Propósito**: Escribir documentación en Markdown para cada sección.

| Campo | Descripción |
|-------|-------------|
| **Input** | `flat_tree`, `ExplorerOutput`, `sections[]`, `repo_path` |
| **Output** | `WriterOutput` |

**Proceso**:
1. Itera sobre cada sección del PlannerOutput
2. Para cada sección:
   - Lee los archivos asignados (keyFiles)
   - Detecta imports directos de esos archivos (archivos adyacentes)
   - Lee archivos adyacentes si son necesarios
   - Escribe contenido en Markdown
   - Guarda archivo en `wiki_output/{repo_id}/{index}-{slug}.md`
3. Límite: ~800 tokens por sección

**Formato de Referencias de Código**:
```markdown
---
${code-reference: path/to/file}
```lenguaje
code here
```
---
```

Para código largo:
```markdown
---
${code-reference: path/to/file}
```lenguaje
// código largo
```
---

**Código simplificado**
```

**WriterOutput Schema**:
```typescript
interface WriterOutput {
  files: string[]  // Paths de MD generados
}
```

**Prompts**:
- `writer/system` - System prompt con formato de código
- `writer/write-section` - Escribir contenido por sección

---

### 4. CheckerAgent

**Propósito**: Validar calidad de documentación generada vs planificar.

| Campo | Descripción |
|-------|-------------|
| **Input** | `plannedSections`, `generatedFiles`, `repo_path` |
| **Output** | `CheckerOutput` |

**Proceso**:
1. Compara secciones planificadas vs archivos generados
2. Analiza coverage (%)
3. Genera diagnóstico breve
4. Guarda en `wiki_output/{repo_id}/checker.md`

**CheckerOutput Schema**:
```typescript
interface CheckerOutput {
  diagnosis: string       // Texto libre con hallazgos
  sectionCoverage: number // Porcentaje (0-100)
}
```

**Output File**: `wiki_output/{repo_id}/checker.md`

---

## Formato de Código en Documentación

### Code Block Estándar
```markdown
---
${code-reference: path/to/file}
```javascript
const hello = "world";
```
---
```

### Code Block con Resumen (código largo)
```markdown
---
${code-reference: path/to/file}
```python
# Código simplificado
def process():
    pass
```
---

**Código simplificado**: Versión reducida que muestra la lógica principal sin boilerplate.
```

---

## Límites y Restricciones

| Parámetro | Valor |
|-----------|-------|
| KeyFiles en Explorer | 8-10 máx |
| Overview en Explorer | ≤150 palabras |
| Secciones en Planner | 5-8 |
| Tokens por sección Writer | ~800 máx |
| Archivos adyacentes Writer | Solo imports directos |

---

## Pipeline en Server.ts

```typescript
// POST /docs-gen

// 1. Explorer
const explorerOutput = await explorerAgent.run({
  flatTree: body.flatTree,
  repoPath: body.repoPath
})

// 2. Planner
const plannerOutput = await plannerAgent.run({
  explorerOutput,
  flatTree: body.flatTree,
  repoPath: body.repoPath
})

// 3. Writer
const writerOutput = await writerAgent.run({
  flatTree: body.flatTree,
  explorerOutput,
  sections: plannerOutput.sections,
  repoPath: body.repoPath
})

// 4. Checker
const checkerOutput = await checkerAgent.run({
  plannedSections: plannerOutput.sections,
  generatedFiles: writerOutput.files,
  repoPath: body.repoPath
})

return c.json({
  repo_id: body.repoId,
  message: "Documentation generated",
  diagnosis: checkerOutput.diagnosis,
  coverage: checkerOutput.sectionCoverage
})
```

---

## Archivos a Crear/Modificar

### Nuevos
- `.diagrams/agents-arch.md` (este documento)
- `apps/wiki/src/schemas/planner.schema.ts`
- `apps/wiki/src/schemas/writer.schema.ts`
- `apps/wiki/src/schemas/checker.schema.ts`
- `apps/wiki/src/agents/planner.ts`
- `apps/wiki/src/agents/checker.ts`
- `config/explorer/detect-keyfiles.txt`
- `config/explorer/summarize.txt`
- `config/planner/create-sections.txt`
- `config/writer/write-section.txt`
- `config/checker/diagnose.txt`

### Modificar
- `apps/wiki/src/schemas/explorer.schema.ts` (actualizar)
- `apps/wiki/src/agents/explorer.ts` (refactorizar)
- `apps/wiki/src/agents/writer.ts` (refactorizar)
- `apps/wiki/src/server.ts` (actualizar pipeline)
- `config/writer/00.system.txt` (actualizar formato código)
