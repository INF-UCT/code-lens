# Guía de Implementación de DeepWiki

## Sistema de Documentación Automática con RAG

---

Esta guía técnica te ayudará a entender cómo funciona DeepWiki-Open para que puedas implementar un sistema similar. Cubriremos los tres pilares fundamentales:

1. **Indexación**: Cómo transformar un repositorio en índices vectoriales
2. **Generación de Wiki**: Cómo crear documentación automática con diagramas
3. **Chat RAG**: Cómo responder preguntas sobre el código usando Retrieval Augmented Generation

---

## 1. Visión General del Sistema

DeepWiki es una aplicación full-stack que analiza repositorios de GitHub, GitLab o Bitbucket y genera:

- Documentación interactiva en formato wiki
- Diagramas visuales (Mermaid) de la arquitectura
- Un asistente conversacional capaz de responder preguntas sobre el código

### Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                              │
│  Puerto 3000                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  WikiViewer    │  │   Ask.tsx       │  │   Mermaid.tsx           │  │
│  │  (Navegación)  │  │  (Chat RAG)     │  │   (Diagramas)           │  │
│  └────────┬────────┘  └────────┬────────┘  └───────────┬─────────────┘  │
└───────────┼─────────────────────┼───────────────────────┼────────────────┘
            │                     │                       │
            │ HTTP/WebSocket      │                       │
            ▼                     ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                                │
│  Puerto 8001                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │ data_pipeline   │  │     rag.py      │  │  simple_chat.py         │  │
│  │ (Indexación)    │  │  (Retrieval)    │  │  (Streaming)            │  │
│  └────────┬────────┘  └────────┬────────┘  └───────────┬─────────────┘  │
└───────────┼─────────────────────┼───────────────────────┼────────────────┘
            │                     │                       │
            ▼                     ▼                       ▼
   ~/.adalflow/           ~/.adalflow/              ~/.adalflow/
      repos/                 databases/                wikicache/
   (Git clones)        (Índices FAISS)          (Wiki cache)
```

### Tecnologías Principales

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS |
| **Backend** | FastAPI (Python), Uvicorn |
| **LLM** | OpenAI, Google Gemini, OpenRouter, Ollama, AWS Bedrock, Azure, Dashscope |
| **Embeddings** | OpenAI text-embedding-3-small, Google, Ollama, Bedrock Titan |
| **Vector Store** | FAISS (Facebook AI Similarity Search) |
| **Framework AI** | AdalFlow |

---

## 2. Estructura del Proyecto

```
deepwiki-open/
├── api/                          # Backend Python
│   ├── main.py                   # Entry point FastAPI
│   ├── api.py                    # Endpoints REST
│   ├── rag.py                    # Motor RAG
│   ├── data_pipeline.py          # Pipeline de indexación
│   ├── simple_chat.py            # Chat con streaming
│   ├── websocket_wiki.py         # WebSocket para wiki
│   ├── prompts.py                # Prompts LLM
│   ├── config/                   # Configuraciones JSON
│   │   ├── generator.json       # Modelos LLM
│   │   ├── embedder.json        # Embeddings
│   │   └── repo.json            # Filtros de archivos
│   └── tools/
│       └── embedder.py           # Factory de embedders
│
├── src/                          # Frontend Next.js
│   ├── app/
│   │   └── [owner]/[repo]/      # Wiki pages dinámicas
│   ├── components/
│   │   ├── Ask.tsx              # Componente de chat RAG
│   │   ├── Mermaid.tsx          # Renderizador de diagramas
│   │   └── Markdown.tsx         # Renderizador Markdown
│   └── utils/
│       └── websocketClient.ts   # Cliente WebSocket
│
└── docs/
    └── guia-implementacion/      # Esta guía
        ├── 01-arquitectura.md
        ├── 02-indexacion.md
        ├── 03-wiki.md
        ├── 04-chat-rag.md
        └── 05-configuracion.md
```

---

## 3. Flujo de Datos Completo

El sistema opera en tres fases secuenciales:

### Fase 1: Indexación (Preparación)

```
Repositorio GitHub/GitLab
         │
         ▼
    [Clonación] ──────────────► ~/.adalflow/repos/{owner}_{repo}/
         │
         ▼
    [Lectura de archivos]
    (.py, .js, .ts, .md, etc.)
         │
         ▼
    [Chunking] ─────────────── 350 palabras por chunk, 100 overlap
         │
         ▼
    [Embeddings] ────────────► Generación de vectores numéricos
         │
         ▼
    [FAISS Index] ────────────► ~/.adalflow/databases/{repo}.pkl
```

### Fase 2: Generación de Wiki

```
Archivo indexado
         │
         ▼
    [Estructura] ◄──────────── LLM analiza file tree + README
    (XML con páginas)           Genera 8-12 páginas organizadas
         │
         ▼
    [Contenido por página]
    LLM genera:
    - Descripciones técnicas
    - Diagramas Mermaid
    - Tablas de APIs
    - Snippets de código
         │
         ▼
    [Cache] ──────────────────► ~/.adalflow/wikicache/
```

### Fase 3: Chat RAG

```
Usuario: "¿Cómo funciona la autenticación?"
         │
         ▼
    [Embedding de query]
    Transformar pregunta a vector
         │
         ▼
    [FAISS Retrieval] ──────────► Top-k documentos relevantes
    Búsqueda por similitud coseno
         │
         ▼
    [Construir Prompt]
    Contexto + Historial + Pregunta
         │
         ▼
    [LLM Generation] ◄────────── Streaming de respuesta
    Con contexto retrieveado
```

---

## 4. Conceptos Clave

### 4.1 ¿Qué es RAG?

**Retrieval Augmented Generation** (Generación Aumentada por Retrieval) es una técnica que:

1. **Recupera** información relevante de una base de conocimientos (en este caso, el código del repo)
2. **Amplía** el prompt del LLM con ese contexto
3. **Genera** una respuesta más precisa y fundamentada

Esto evita que el LLM "alucine" y le da respuestas basadas en el código real.

### 4.2 ¿Qué son los Embeddings?

Los embeddings son **representaciones vectoriales** de texto. Cada palabra, oración o documento se convierte en un array de números (vectores) que capturan su significado semántico.

- Textos **similares** tienen vectores **cercanos** en el espacio n-dimensional
- Esto permite buscar por "significado" no solo por palabras exactas

### 4.3 ¿Qué es FAISS?

**FAISS** (Facebook AI Similarity Search) es una librería eficiente para:

- Almacenar millones de vectores
- Buscar los k-vectores más cercanos a una query
- Es extremadamente rápido comparando con bases de datos tradicionales

---

## 5. Preparación del Entorno

Para implementar algo similar, necesitas:

### Backend (Python)

```bash
# Instalar dependencias
python -m pip install poetry==2.0.1
poetry install -C api

# Variables de entorno requeridas
GOOGLE_API_KEY=tu_google_api_key      # Para Gemini
OPENAI_API_KEY=tu_openai_api_key     # Para GPT
DEEPWIKI_EMBEDDER_TYPE=openai        # openai, google, ollama, bedrock
```

### Dependencias Principales (pyproject.toml)

```toml
[dependencies]
fastapi = "^0.95.0"
uvicorn = "^0.23.0"
adalflow = "^0.1.0"
faiss-cpu = "^1.7.0"
tiktoken = "^0.5.0"
openai = "^1.0.0"
google-generativeai = "^0.3.0"
aiohttp = "^3.8.0"
websockets = "^11.0.0"
```

---

## Siguiente Paso

En la siguiente sección, profundizaremos en la **Fase 1: Indexación**,
donde explicaremos cómo el sistema:

- Clona repositorios
- Lee y filtra archivos
- Genera embeddings
- Crea índices FAISS

➡️ **[02-indexacion.md](02-indexacion.md)**

---

## Referencias del Código

| Componente | Archivo | Líneas |
|------------|---------|--------|
| Clonación | `api/data_pipeline.py` | 72-148 |
| Lectura archivos | `api/data_pipeline.py` | 153-380 |
| Chunking | `api/data_pipeline.py` | 382-450 |
| Embeddings | `api/data_pipeline.py` | 400-419 |
| FAISS Index | `api/rag.py` | 383-391 |
