# Fase 1: Indexación del Repositorio

## Conversión de Código a Vectores

La indexación es el proceso de transformar un repositorio Git en un formato que permita búsquedas semánticas eficientes. Esta fase convierte el código fuente en vectores numéricos almacenados en FAISS.

**Archivo principal:** `api/data_pipeline.py`

---

## 1. Flujo de Indexación

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PIPELINE DE INDEXACIÓN                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │   Clonar   │───▶│    Leer    │───▶│  Crear Doc  │                │
│  │   Repo     │    │  Archivos  │    │   Objects   │                │
│  └─────────────┘    └─────────────┘    └──────┬──────┘                │
│                                                │                        │
│                                                ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                │
│  │   Guardar  │◀───│  FAISS     │◀───│ Embeddings  │                │
│  │    Index   │    │   Index    │    │  Generation │                │
│  └─────────────┘    └─────────────┘    └─────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Clonación del Repositorio

**Función:** `download_repo()` en `data_pipeline.py:72-148`

### Proceso Detallado

```python
def download_repo(repo_url: str, local_path: str, 
                 repo_type: str = None, access_token: str = None) -> str:
```

### Paso 1: Detectar Tipo de Repo

El sistema soporta tres proveedores de Git:

| Tipo | URL Format | Autenticación |
|------|------------|---------------|
| **GitHub** | `github.com/owner/repo` | Token en URL: `https://{token}@{domain}/...` |
| **GitLab** | `gitlab.com/owner/repo` | OAuth2: `https://oauth2:{token}@{domain}/...` |
| **Bitbucket** | `bitbucket.org/owner/repo` | Token auth: `https://x-token-auth:{domain}/...` |

### Paso 2: Autenticación

Si se proporciona un token de acceso:

```python
# GitHub: https://{token}@{domain}/owner/repo.git
clone_url = urlunparse((parsed.scheme, f"{encoded_token}@{parsed.netloc}", 
                        parsed.path, '', '', ''))

# GitLab: https://oauth2:{token}@{domain}/owner/repo.git  
clone_url = urlunparse((parsed.scheme, f"oauth2:{encoded_token}@{parsed.netloc}", 
                        parsed.path, '', '', ''))

# Bitbucket: https://x-token-auth:{token}@{domain}/owner/repo.git
clone_url = urlunparse((parsed.scheme, f"x-token-auth:{encoded_token}@{parsed.netloc}", 
                        parsed.path, '', '', ''))
```

### Paso 3: Shallow Clone

```python
# Solo última versión, sin historial
result = subprocess.run(
    ["git", "clone", "--depth=1", "--single-branch", clone_url, local_path],
    check=True
)
```

**Parámetros:**
- `--depth=1`: Solo el último commit (más rápido)
- `--single-branch`: Solo la rama actual

### Ubicación de Almacenamiento

```
~/.adalflow/repos/{}/
```

Porowner}_{repo_name ejemplo: `~/.adalflow/repos/AsyncFuncAI_deepwiki-open/`

---

## 3. Lectura de Archivos

**Función:** `read_all_documents()` en `data_pipeline.py:153-380`

### Extensiones Soportadas

```python
# Archivos de código
code_extensions = [".py", ".js", ".ts", ".java", ".cpp", ".c", ".h", ".hpp", 
                   ".go", ".rs", ".jsx", ".tsx", ".html", ".css", ".php", 
                   ".swift", ".cs"]

# Documentación
doc_extensions = [".md", ".txt", ".rst", ".json", ".yaml", ".yml"]
```

### Sistema de Filtrado

El sistema implementa dos modos de filtrado:

#### Modo Exclusión (Por Defecto)

Excluye directorios y archivos problemáticos:

```python
DEFAULT_EXCLUDED_DIRS = [
    ".git", "node_modules", "__pycache__", "venv", ".venv", "env",
    "build", "dist", ".next", "out", ".nuxt", ".svelte-kit",
    "vendor", "target", "bin", "obj", "packages"
]

DEFAULT_EXCLUDED_FILES = [
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "*.min.js", "*.min.css", "*.bundle.js",
    ".DS_Store", "Thumbs.db"
]
```

**Lógica:** "Procesar todo EXCEPETO estos"

#### Modo Inclusión

Solo procesa directorios o archivos específicos:

```python
included_dirs = ["src/", "lib/"]
included_files = ["*.py", "*.js"]
```

**Lógica:** "Solo procesar ESTOS"

### Límites de Tamaño

```python
MAX_EMBEDDING_TOKENS = 8192

# Archivos de código: máximo 10x (81,920 tokens)
if token_count > MAX_EMBEDDING_TOKENS * 10:
    skip_file()

# Documentos: máximo 1x (8,192 tokens)
if token_count > MAX_EMBEDDING_TOKENS:
    skip_file()
```

### Conteo de Tokens

```python
def count_tokens(text: str, embedder_type: str = None) -> int:
    # OpenAI usa cl100k_base o el encoding específico del modelo
    encoding = tiktoken.encoding_for_model("text-embedding-3-small")
    return len(encoding.encode(text))
```

---

## 4. Creación de Documentos

Cada archivo se convierte en un objeto `Document` de AdalFlow:

```python
from adalflow.core.types import Document

doc = Document(
    text=contenido_del_archivo,
    meta_data={
        "file_path": "src/utils/auth.py",        # Ruta relativa
        "type": "py",                             # Extensión
        "is_code": True,                          # Es código?
        "is_implementation": True,               # Es implementación (no test)?
        "title": "src/utils/auth.py",             
        "token_count": 1500
    }
)
```

### Metadata Importante

| Campo | Descripción |
|-------|-------------|
| `file_path` | Ruta relativa desde la raíz del repo |
| `type` | Extensión sin punto (py, js, ts, md...) |
| `is_code` | `True` para archivos de código, `False` para docs |
| `is_implementation` | `True` si NO es archivo de test |
| `token_count` | Cantidad de tokens del archivo |

**Nota:** Los archivos de test se marcan con `is_implementation=False` para poder filtrarlos si es necesario.

---

## 5. Chunking (División de Texto)

**Configuración** en `config/embedder.json`:

```json
{
    "text_splitter": {
        "split_by": "word",
        "chunk_size": 350,
        "chunk_overlap": 100
    }
}
```

### Proceso de Chunking

```python
from adalflow.components.data_process import TextSplitter

splitter = TextSplitter(
    split_by="word",
    chunk_size=350,     # Palabras por chunk
    chunk_overlap=100  # Palabras que se repiten entre chunks
)

# Input: Documento grande
# Output: Lista de Documentos más pequeños
chunks = splitter([document_grande])
```

### ¿Por qué hacer chunks?

1. **Límites de contexto:** Los LLMs tienen límites de tokens (ej: 8K, 32K, 128K)
2. **Precisión检索:** Chunk más pequeños = más relevancia en búsquedas
3. **Overlap:** Mantiene contexto entre chunks adyacentes

### Ejemplo

```
Texto original (1000 palabras):
"Esta es una función que autentica usuarios. Recibe un email y password.
Verifica las credenciales contra la base de datos. Retorna un token JWT..."

Chunks resultado:
Chunk 1: "Esta es una función que autentica usuarios. Recibe un email y password."
Chunk 2: "Recibe un email y password. Verifica las credenciales contra la base de datos."
Chunk 3: "Verifica las credenciales contra la base de datos. Retorna un token JWT."
```

---

## 6. Generación de Embeddings

**Función:** `get_embedder()` en `api/tools/embedder.py`

### Proveedores Soportados

| Proveedor | Modelo | Dimensiones | Batch Size |
|-----------|--------|-------------|------------|
| **OpenAI** (default) | `text-embedding-3-small` | 256 | 500 |
| **Google** | `gemini-embedding-001` | 768 | 100 |
| **Ollama** | `nomic-embed-text` | 768 | N/A |
| **AWS Bedrock** | `amazon.titan-embed-text-v2:0` | 256 | 100 |

### Selección de Proveedor

```python
# Variable de entorno
import os
embedder_type = os.getenv("DEEPWIKI_EMBEDDER_TYPE", "openai")

# Factory function
def get_embedder():
    if embedder_type == "openai":
        return OpenAIEmbedder(model="text-embedding-3-small")
    elif embedder_type == "google":
        return GoogleEmbedder(model="gemini-embedding-001")
    elif embedder_type == "ollama":
        return OllamaEmbedder(model="nomic-embed-text")
    elif embedder_type == "bedrock":
        return BedrockEmbedder(model="amazon.titan-embed-text-v2:0")
```

### Proceso de Embedding

```python
from adalflow.components.data_process import ToEmbeddings

# Para OpenAI, Google, Bedrock (batch processing)
embedder_transformer = ToEmbeddings(
    embedder=embedder,
    batch_size=500  # Procesa 500 documentos a la vez
)

# Para Ollama (procesamiento secuencial)
embedder_transformer = OllamaDocumentProcessor(embedder=embedder)

# Generar embeddings
documents_with_embeddings = embedder_transformer(chunks)
```

### ¿Qué es un Embedding?

```
Texto: "función de autenticación de usuarios"
         │
         ▼
    [Embedding Model]
         │
         ▼
Vector: [0.123, -0.456, 0.789, 0.012, -0.345, ...]  (256 dimensiones)
```

Cada texto se convierte en un array de 256 números (para OpenAI text-embedding-3-small).

---

## 7. Creación del Índice FAISS

**Clase:** `DatabaseManager` en `data_pipeline.py`

### ¿Qué es FAISS?

FAISS (Facebook AI Similarity Search) es una librería de Meta que permite:
- Almacenar millones de vectores eficientemente
- Buscar vectores similares muy rápido
- Usar diferentes métricas de similitud

### Proceso de Creación

```python
from adalflow.components.retriever.faiss_retriever import FAISSRetriever
from adalflow.core.db import LocalDB

# 1. Crear retriever FAISS
retriever = FAISSRetriever(
    top_k=20,  # Retornar los 20 más similares
    embedder=embedder,
    documents=documents_with_embeddings,
    document_map_func=lambda doc: doc.vector  # Función para obtener el vector
)

# 2. Guardar en disco
db = LocalDB()
db.save_state(
    state={
        "retriever": retriever,
        "documents": documents_with_embeddings
    },
    path="~/.adalflow/databases/{repo_name}.pkl"
)
```

### Estructura del Índice Guardado

```
~/.adalflow/databases/
├── deepwiki-open.pkl        # Repo 1
├── my-app.pkl              # Repo 2
└── otro-proyecto.pkl       # Repo 3
```

Cada archivo `.pkl` contiene:
- Índice FAISS con todos los vectores
- Metadatos de cada documento
- Mapeo entre vectores y contenidos

---

## 8. Clase DatabaseManager

**Ubicación:** `data_pipeline.py:500-650`

Esta clase orchest toda la pipeline de indexación:

```python
class DatabaseManager:
    def prepare_database(self, repo_url: str, ...):
        # Paso 1: Descargar repo
        local_path = self.download_repo(...)
        
        # Paso 2: Leer documentos
        documents = self.read_all_documents(local_path, ...)
        
        # Paso 3: Transformar y guardar
        self.transform_documents_and_save_to_db(
            documents, 
            repo_name
        )
    
    def transform_documents_and_save_to_db(self, documents, repo_name):
        # Chunking
        chunks = text_splitter(documents)
        
        # Embeddings
        embedded_docs = embedder_transformer(chunks)
        
        # Guardar en FAISS
        db.save_state(...)
```

---

## 9. Resumen del Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RESUMEN: INDEXACIÓN                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CLONAR                                                             │
│     URL + Token → git clone --depth=1 → ~/.adalflow/repos/           │
│                                                                         │
│  2. LEER ARCHIVOS                                                      │
│     *.py, *.js, *.ts, *.md → Document objects                         │
│     + Filtrado (exclusión/inclusión)                                   │
│     + Conteo de tokens (límites)                                      │
│                                                                         │
│  3. CHUNKING                                                           │
│     Documento grande → 350 palabras/chunk → 100 overlap               │
│                                                                         │
│  4. EMBEDDINGS                                                         │
│     Texto → [0.12, -0.45, 0.67, ...] (256 dim)                        │
│     OpenAI/Google/Ollama/Bedrock                                      │
│                                                                         │
│  5. ÍNDICE FAISS                                                       │
│     Vectores + Metadatos → ~/.adalflow/databases/{repo}.pkl          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Implementación Propia: Checklist

Si quieres implementar un sistema similar:

### Step-by-Step

- [ ] **Clonar repo**: Usar `subprocess.run(["git", "clone", ...])`
- [ ] **Leer archivos**: `glob.glob("**/*.py", recursive=True)`
- [ ] **Filtrar**: Excluir `.git`, `node_modules`, etc.
- [ ] **Token counting**: Usar `tiktoken`
- [ ] **Chunking**: Usar `adalflow.TextSplitter` o implementar uno propio
- [ ] **Embeddings**: Usar OpenAI API o librería similar
- [ ] **FAISS**: `faiss.IndexFlatIP(embedding_dim)` para similitud coseno
- [ ] **Guardar**: `faiss.write_index()` + pickle de metadatos

### Herramientas Recomendadas

```python
# Básicas
import subprocess   # Git
import glob         # Archivos
import tiktoken     # Tokens

# Embeddings
from openai import OpenAI  # OpenAI
import requests            # Ollama

# Vector Store
import faiss
import numpy as np

# Storage
import pickle
```

---

## Siguiente Paso

La indexación crea la base de datos vectorial. Ahora la **Fase 2** usa esa
base para **generar documentación automáticamente**.

➡️ **[03-wiki.md](03-wiki.md)**

---

## Referencias

| Componente | Archivo | Líneas |
|------------|---------|--------|
| `download_repo` | `api/data_pipeline.py` | 72-148 |
| `read_all_documents` | `api/data_pipeline.py` | 153-380 |
| `count_tokens` | `api/data_pipeline.py` | 27-70 |
| TextSplitter | `api/data_pipeline.py` | 382-450 |
| Embedder factory | `api/tools/embedder.py` | - |
| FAISS Index | `api/rag.py` | 383-391 |
