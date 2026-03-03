# Guía de Implementación de DeepWiki

## Documentación Técnica Detallada

---

## 📋 Índice de Contenidos

Esta guía te enseña a implementar un sistema similar a DeepWiki: documentación automática de repositorios con RAG.

### 📖 Guías por Tema

| # | Guía | Descripción |
|---|------|-------------|
| 01 | **[Arquitectura General](01-arquitectura.md)** | Visión de alto nivel del sistema, componentes, tecnologías y flujo de datos |
| 02 | **[Indexación](02-indexacion.md)** | Pipeline para convertir código en vectores FAISS: clonación, chunking, embeddings |
| 03 | **[Generación Wiki](03-wiki.md)** | Cómo generar documentación automática con diagramas Mermaid |
| 04 | **[Chat RAG](04-chat-rag.md)** | Sistema de preguntas y respuestas usando Retrieval Augmented Generation |
| 05 | **[Configuración](05-configuracion.md)** | Proveedores LLM, embeddings, variables de entorno |

---

## 🎯 quick Start: Conceptos Clave

### Las Tres Fases del Sistema

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ INDEXACIÓN  │────▶│    WIKI     │────▶│  CHAT RAG   │
│             │     │             │     │             │
│ Repo → FAISS│     │ Docs auto   │     │ Q&A sobre   │
│             │     │ + Diagramas │     │ el código   │
└─────────────┘     └─────────────┘     └─────────────┘
```

1. **Indexación**: Transforma el código en índices vectoriales searchable
2. **Wiki**: Genera documentación estática con IA
3. **Chat RAG**: Responde preguntas dinámicas usando el código como contexto

### Tecnologías Principales

| Componente | Tecnología |
|------------|------------|
| Backend | FastAPI (Python) |
| Frontend | Next.js 15 (React) |
| Vector Store | FAISS |
| Framework AI | AdalFlow |
| Embeddings | OpenAI, Google, Ollama, Bedrock |
| LLMs | GPT-4, Gemini, Claude, Llama, Qwen |

---

## 📚 Estructura de la Guía

### 01 - Arquitectura General

- Visión de alto nivel
- Componentes del sistema
- Tecnologías utilizadas
- Flujo de datos completo
- Preparación del entorno

**[Leer →](01-arquitectura.md)**

---

### 02 - Indexación (Fase 1)

- Clonación de repositorios Git
- Lectura y filtrado de archivos
- Sistema de chunking (350 palabras, 100 overlap)
- Generación de embeddings
- Creación de índices FAISS

**[Leer →](02-indexacion.md)**

---

### 03 - Generación Wiki (Fase 2)

- Obtención del file tree
- Creación de estructura XML
- Generación de contenido por página
- Diagramas Mermaid automáticos
- Cache del wiki generado

**[Leer →](03-wiki.md)**

---

### 04 - Chat RAG (Fase 3)

- ¿Qué es RAG y por qué usarlo?
- Embedding de consultas
- Búsqueda FAISS por similitud
- Construcción de prompts RAG
- Streaming de respuestas
- Modo Deep Research

**[Leer →](04-chat-rag.md)**

---

### 05 - Configuración

- Proveedores LLM disponibles
- Modelos de embeddings
- Variables de entorno requeridas
- Cómo añadir nuevos proveedores
- Filtros de archivos

**[Leer →](05-configuracion.md)**

---

## 🔧 Implementación Rápida

### Código Mínimo RAG

```python
# 1. Indexar repositorio
def index_repo(repo_url):
    # Clonar
    subprocess.run(["git", "clone", repo_url, "./temp_repo"])
    
    # Leer archivos
    documents = read_files("./temp_repo")
    
    # Chunking
    chunks = text_splitter(documents)
    
    # Embeddings
    vectors = embedder(chunks)
    
    # FAISS index
    index = faiss.IndexFlatIP(256)
    index.add(vectors)
    faiss.write_index(index, "repo.index")

# 2. Consultar
def query(question):
    # Embed pregunta
    q_vec = embed([question])
    
    # Buscar
    _, ids = index.search(q_vec, k=5)
    context = [documents[i] for i in ids]
    
    # Prompt
    prompt = f"Contexto: {context}\n\nPregunta: {question}"
    
    # Responder
    return llm.generate(prompt)
```

---

## 📂 Archivos del Proyecto

```
docs/guia-implementacion/
├── README.md              # Este archivo
├── 01-arquitectura.md    # Arquitectura general
├── 02-indexacion.md      # Indexación/FAISS
├── 03-wiki.md            # Generación wiki
├── 04-chat-rag.md        # Chat RAG
└── 05-configuracion.md   # Config y proveedores
```

---

## 🔗 Referencias del Código Original

| Componente | Archivo | Líneas |
|------------|---------|--------|
| Clonación | `api/data_pipeline.py` | 72-148 |
| Lectura archivos | `api/data_pipeline.py` | 153-380 |
| Chunking | `api/data_pipeline.py` | 382-450 |
| Embeddings | `api/data_pipeline.py` | 400-419 |
| FAISS Index | `api/rag.py` | 383-391 |
| Motor RAG | `api/rag.py` | 1-445 |
| Chat API | `api/simple_chat.py` | 438-557 |
| WebSocket | `api/websocket_wiki.py` | - |
| Wiki page | `src/app/[owner]/[repo]/page.tsx` | 372-600 |
| Ask component | `src/components/Ask.tsx` | - |

---

## ✅ Próximos Pasos

1. **Leer la Guía 01** para entender la arquitectura
2. **Seguir la Guía 02** para implementar indexación
3. **Continuar con 03 y 04** para wiki y chat RAG
4. **Consultar 05** para configuración de proveedores

---

*Guía creada a partir del análisis del código de DeepWiki-Open*
