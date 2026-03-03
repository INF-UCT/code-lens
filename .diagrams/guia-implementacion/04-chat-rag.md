# Fase 3: Chat RAG

## Sistema de Preguntas y Respuestas sobre el Código

El chat RAG permite hacer preguntas en lenguaje natural sobre el código y obtener respuestas fundamentadas en el código real del repositorio.

**Archivos principales:**
- Motor RAG: `api/rag.py`
- Chat API: `api/simple_chat.py`, `api/websocket_wiki.py`
- Frontend: `src/components/Ask.tsx`

---

## 1. ¿Qué es RAG?

### El Problema

Los LLMs como GPT-4 o Gemini tienen conocimiento general pero:

1. **No conocen tu código específico**: No saben cómo implementaste tu proyecto
2. **Pueden "alucinar"**: Inventar funciones que no existen
3. **Contexto limitado**: No pueden leer archivos grandes

### La Solución: RAG

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    retrieval augmented generation                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PREGUNTA ──▶ EMBEDDING ──▶ FAISS ──▶ TOP-K DOCS ──▶ PROMPT ──▶ LLM  │
│                Query        Search    Contexto      (Datos + Query)    │
│                                                                         │
│   El LLM responde usando el código REAL como referencia               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Flujo:**
1. **Retrieval**: Buscar documentos relevantes en la base vectorial
2. **Augmentation**: Añadir esos documentos al prompt
3. **Generation**: El LLM genera respuesta con ese contexto

---

## 2. Arquitectura del Chat RAG

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA CHAT RAG                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │  Frontend   │───▶│  WebSocket   │───▶│    RAG      │              │
│  │   Ask.tsx   │    │  / HTTP      │    │   Engine    │              │
│  └──────────────┘    └──────────────┘    └──────┬───────┘              │
│                                                 │                      │
│                                                 ▼                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   UI        │◀───│   LLM        │◀───│   FAISS     │              │
│  │ Streaming   │    │  Streaming   │    │  Retrieval  │              │
│  └──────────────┘    └──────────────┘    └──────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Flujo Detallado del Chat RAG

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO: CHAT RAG COMPLETO                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  USUARIO: "¿Cómo funciona la autenticación?"                           │
│                           │                                             │
│                           ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 1. EMBEDDING DE LA CONSULTA                                     │   │
│  │    "Cómo funciona la autenticación?"                            │   │
│  │    → [0.12, -0.34, 0.56, ...] (256 dimensiones)                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 2. FAISS RETRIEVAL (Similarity Search)                          │   │
│  │                                                                    │   │
│  │    Query vector                                                   │   │
│  │         │                                                         │   │
│  │         ▼                                                         │   │
│  │    ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  top-k=20            │   │
│  │    │ v1 │  │ v2 │  │ v3 │  │ v4 │  │ v5 │  (más similares)    │   │
│  │    └────┘  └────┘  └────┘  └────┘  └────┘                      │   │
│  │                                                                    │   │
│  │    Cada vector = un chunk de código                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 3. CONTEXTO RETRIEVED                                            │   │
│  │                                                                    │   │
│  │    ## File: src/auth/login.py                                    │   │
│  │    ```python                                                     │   │
│  │    def authenticate(email, password):                            │   │
│  │        user = db.find_user(email)                                │   │
│  │        if verify_password(password, user.hash):                  │   │
│  │            return generate_token(user)                           │   │
│  │    ```                                                           │   │
│  │                                                                    │   │
│  │    ## File: src/middleware/auth.py                               │   │
│  │    ```python                                                     │   │
│  │    def verify_token(token):                                      │   │
│  │        payload = jwt.decode(token, SECRET)                       │   │
│  │        return payload['user_id']                                 │   │
│  │    ```                                                           │   │
│  │                                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 4. CONSTRUIR PROMPT RAG                                          │   │
│  │                                                                    │   │
│  │    <SYSTEM> Eres asistente experto en código... </SYSTEM>       │   │
│  │    <CONTEXT>                                                     │   │
│  │    Archivos relevantes retrievalados...                         │   │
│  │    </CONTEXT>                                                    │   │
│  │    <QUERY> Cómo funciona la autenticación? </QUERY>             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 5. LLM GENERATION (Streaming)                                    │   │
│  │                                                                    │   │
│  │    "El sistema de autenticación funciona así:"                  │   │
│  │    "1. El usuario envía credenciales..."                         │   │
│  │    "2. El servidor verifica..."                                  │   │
│  │    "3. Genera un JWT token..."                                   │   │
│  │    (en tiempo real)                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  USUARIO: Recibe respuesta con citas al código fuente                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Motor RAG

**Clase:** `RAG` en `api/rag.py`

### Inicialización

```python
class RAG:
    def __init__(self, repo_url: str, provider: str = "google", 
                 model: str = None, ...):
        self.repo_url = repo_url
        self.provider = provider
        self.model = model
        
        # Cargar índice FAISS
        self.prepare_retriever()
```

### Método: prepare_retriever()

Carga el índice FAISS del repositorio:

```python
def prepare_retriever(self):
    # 1. DatabaseManager carga/clona el repo
    db_manager = DatabaseManager()
    db_manager.prepare_database(repo_url)
    
    # 2. Carga documentos y embeddings
    self.transformed_docs = db_manager.load_from_db()
    
    # 3. Crea FAISS retriever
    self.retriever = FAISSRetriever(
        top_k=20,  # Retorna los 20 más similares
        embedder=get_embedder(),
        documents=self.transformed_docs,
        document_map_func=lambda doc: doc.vector
    )
```

### Método: query()

Ejecuta la consulta RAG:

```python
def query(self, query_str: str, conversation_history: list = None):
    # 1. Retrieval: obtener documentos relevantes
    retrieved_docs = self.retriever(query_str)
    
    # 2. Formatear contexto
    context = self.format_context(retrieved_docs)
    
    # 3. Construir prompt
    prompt = self.build_prompt(query_str, context, conversation_history)
    
    # 4. Generar respuesta (streaming)
    return self.generate_streaming(prompt)
```

---

## 5. Retrieval: Búsqueda en FAISS

### Similitud Coseno

FAISS usa búsqueda por similitud coseno:

```
        
           Query ★
           │
           │    ★ Doc3 (0.75)
           │       
    ┌──────┼──────┐
    │  ★    │      │  ★ Doc1 (0.92) ←Más similar
    │ Doc2  │      │  
    │(0.65) │      │  ★ Doc4 (0.45)
    └──────┴──────┘
```

### Código de Retrieval

```python
# api/rag.py:426-435
def retrieve(self, query: str):
    # FAISS busca automáticamente los más similares
    results = self.retriever(query)
    
    # Retorna lista de documentos
    return results  # top_k documentos
```

### Parámetro top_k

Configurable en `config/embedder.json`:

```json
{
    "retriever": {
        "top_k": 20
    }
}
```

**Trade-off:**
- **k bajo**: Menos contexto, más preciso pero puede perder info
- **k alto**: Más contexto, más completo pero puede diluir relevancia

---

## 6. Formateo del Contexto

**Función:** `simple_chat.py:206-224`

Los documentos retrievedados se agrupan por archivo:

```python
def format_context(documents):
    # Agrupar por file_path
    docs_by_file = {}
    for doc in documents:
        file_path = doc.meta_data.get('file_path', 'unknown')
        if file_path not in docs_by_file:
            docs_by_file[file_path] = []
        docs_by_file[file_path].append(doc)
    
    # Formatear
    context_parts = []
    for file_path, docs in docs_by_file.items():
        content = "\n\n".join([doc.text for doc in docs])
        context_parts.append(
            f"## File Path: {file_path}\n\n{content}"
        )
    
    return "\n\n" + "-" * 10 + "\n\n".join(context_parts)
```

### Resultado del Formato

```
## File Path: src/auth/login.py

def authenticate_user(email: str, password: str) -> TokenPair:
    """
    Autentica usuario y retorna tokens.
    
    Args:
        email: Email del usuario
        password: Contraseña
    Returns:
        TokenPair con access y refresh token
    Raises:
        InvalidCredentialsError: Si credenciales inválidas
    """
    user = db.users.find_one({"email": email})
    if not user:
        raise InvalidCredentialsError("Usuario no encontrado")
    
    if not bcrypt.checkpw(password.encode(), user['hash']):
        raise InvalidCredentialsError("Contraseña incorrecta")
    
    return generate_tokens(user['_id'])

----------
## File Path: src/middleware/auth.py

def verify_jwt_token(token: str) -> dict:
    """
    Verifica y decodifica JWT token.
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=["HS256"]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError()
```

---

## 7. Construcción del Prompt RAG

**Archivo:** `api/prompts.py`

### Template Base

```python
RAG_TEMPLATE = """<START_OF_SYS_PROMPT>
{system_prompt}
{output_format_str}
<END_OF_SYS_PROMPT>

<START_OF_CONVERSATION_HISTORY>
{dialog_history}
<END_OF_CONVERSATION_HISTORY>

<START_OF_CONTEXT>
{context_str}
<END_OF_CONTEXT>

<START_OF_USER_PROMPT>
{query_str}
<END_OF_USER_PROMPT>
"""
```

### System Prompt

```python
RAG_SYSTEM_PROMPT = """Eres un asistente experto en programación que responde 
basándote únicamente en el código proporcionado.

Instrucciones:
1. Responde en el mismo idioma que la pregunta
2. Usa el código del contexto como única fuente de información
3. Si no tienes suficiente información, dilo claramente
4. Incluye citas de las fuentes (file:line)
5. Sé conciso pero completo
6. Para código, explica qué hace cada parte importante
"""
```

### Prompt Completo Construido

```
<START_OF_SYS_PROMPT>
Eres un asistente experto en programación que responde basándote 
únicamente en el código proporcionado.
...
<END_OF_SYS_PROMPT>

<START_OF_CONVERSATION_HISTORY>
Usuario: ¿Cómo funciona el login?
Asistente: El login usa JWT tokens...
Usuario: ¿Y el logout?
<END_OF_CONVERSATION_HISTORY>

<START_OF_CONTEXT>
## File Path: src/auth/login.py

def authenticate_user(email: str, password: str) -> TokenPair:
    ...
    
----------
## File Path: src/middleware/auth.py

def verify_jwt_token(token: str) -> dict:
    ...
<END_OF_CONTEXT>

<START_OF_USER_PROMPT>
¿Qué sucede cuando un usuario hace logout?
<END_OF_USER_PROMPT>
```

---

## 8. Streaming de Respuesta

### Backend (simple_chat.py:438-557)

```python
async def stream_response(prompt: str, provider: str, model: str):
    if provider == "google":
        model = genai.GenerativeModel(model)
        response = await model.generate_content_async(prompt)
        
        for chunk in response:
            yield chunk.text
            
    elif provider == "openai":
        response = await openai.ChatCompletion.acreate(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        )
        
        async for chunk in response:
            yield chunk.choices[0].delta.content
            
    elif provider == "ollama":
        async for chunk in await ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True
        ):
            yield chunk["message"]["content"]
```

### Frontend (Ask.tsx)

```tsx
// WebSocket connection
const ws = new WebSocket("ws://localhost:8001/ws/chat");

ws.onmessage = (event) => {
  // Acumular chunks
  setFullResponse(prev => prev + event.data);
};

// O HTTP streaming
const response = await fetch("/api/chat/stream", {
  method: "POST",
  body: JSON.stringify({ query, repo_url })
});

const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = new TextDecoder().decode(value);
  // Procesar chunk
}
```

---

## 9. Modo Deep Research

DeepWiki incluye un modo de investigación profunda que itera múltiples veces.

### Funcionamiento

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DEEP RESEARCH                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Iteración 1:                                                     │   │
│  │ "## Research Plan\n\nInvestigar:\n1. Auth flow..."           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Iteración 2:                                                     │   │
│  │ "## Research Update\n\nBasado en hallazgos anteriores..."      │   │
│  │ + Nuevo contexto retrieveado                                     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Iteración 3-4:                                                   │   │
│  │ Investigación más profunda                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Iteración 5 (Final):                                             │   │
│  │ "## Final Conclusion\n\n\nSíntesis de todo..."                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                │                                        │
│                                ▼                                        │
│                    Auto-detect: "## Final Conclusion"                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Prompts de Investigación

```python
# Primera iteración
DEEP_RESEARCH_FIRST_ITERATION_PROMPT = """Comienza la investigación...
## Research Plan

## Next Steps"""

# Iteraciones intermedias  
DEEP_RESEARCH_INTERMEDIATE_ITERATION_PROMPT = """## Research Update {iteration}
Investiga más a fondo los siguientes aspectos...
"""

# Iteración final
DEEP_RESEARCH_FINAL_ITERATION_PROMPT = """## Final Conclusion
Sintetiza todos los hallazgos en una respuesta comprehensiva...
"""
```

### Auto-Continuación

```python
# Detectar si hay más investigación necesaria
def should_continue(response: str, iteration: int) -> bool:
    if iteration >= 5:
        return False
    
    # Buscar keywords de завершения
    final_keywords = ["## Final Conclusion", "## Conclusion", "## Resumen"]
    if any(kw in response for kw in final_keywords):
        return False
    
    return True  # Continuar investigación
```

---

## 10. Manejo de Errores

### Error de Contexto Muy Largo

Si el contexto excede el límite:

```python
# simple_chat.py:564-733
if "maximum context length" in error_message:
    # Reintentar SIN contexto (solo la pregunta)
    simplified_prompt = f"""
    No tengo acceso al código del repositorio en este momento,
    pero puedo ayudarte basándome en mi conocimiento general.
    
    Pregunta: {query}
    """
    # Generar respuesta sin contexto RAG
```

### Validación de Embeddings

```python
# rag.py:251-343
def validate_embeddings(documents):
    valid_docs = []
    for doc in documents:
        if doc.vector is None:
            continue
        if len(doc.vector) != EXPECTED_DIMENSION:
            continue  # Filtrar vectores inconsistentes
        valid_docs.append(doc)
    return valid_docs
```

---

## 11. Resumen del Pipeline RAG

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     RESUMEN: CHAT RAG                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. CONSULTA USUARIO                                                    │
│     "¿Cómo funciona la autenticación?"                                 │
│                                                                         │
│  2. EMBEDDING                                                           │
│     Texto → Vector [0.12, -0.34, 0.56, ...]                           │
│                                                                         │
│  3. FAISS RETRIEVAL                                                     │
│     Buscar top-k documentos más similares                              │
│     (cosine similarity)                                                │
│                                                                         │
│  4. CONTEXTO                                                            │
│     Agrupar por archivo + formatear                                    │
│                                                                         │
│  5. PROMPT RAG                                                          │
│     System + Context + Query + History                                 │
│                                                                         │
│  6. LLM GENERATION                                                      │
│     Streaming response                                                  │
│                                                                         │
│  7. RESPUESTA                                                           │
│     Texto con citas al código fuente                                   │
│                                                                         │
│  + DEEP RESEARCH:                                                       │
│     Iterar 2-5 veces, sintetizando hallazgos                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. Implementación Propia: Guía Rápida

### Paso 1: Embedding de Query

```python
from openai import OpenAI

client = OpenAI()

def embed_query(text):
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return response.data[0].embedding  # Vector
```

### Paso 2: Búsqueda FAISS

```python
import faiss
import numpy as np

# Cargar índice
index = faiss.read_index("repo.index")

# Buscar
query_vector = np.array([embed_query("tu pregunta")])
distances, indices = index.search(query_vector, k=20)

# Obtener documentos
results = [documents[i] for i in indices[0]]
```

### Paso 3: Construir Prompt

```python
def build_prompt(query, context):
    return f"""Contexto del código:
{context}

Pregunta: {query}

Responde basándote únicamente en el contexto proporcionado."""
```

### Paso 4: Generar Respuesta

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "system", "content": "Eres asistente de código."},
        {"role": "user", "content": prompt}
    ],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### Código Completo Simplificado

```python
def rag_query(question: str):
    # 1. Embed
    query_vec = embed_query(question)
    
    # 2. Search
    _, idx = index.search(np.array([query_vec]), k=20)
    docs = [documents[i] for i in idx[0]]
    
    # 3. Context
    context = "\n\n".join([d.text for d in docs])
    
    # 4. Prompt
    prompt = f"Contexto:\n{context}\n\nPregunta: {question}"
    
    # 5. Generate
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )
    
    return response.choices[0].message.content
```

---

## Siguiente Paso

Ahora que entiendes las tres fases principales, la siguiente sección cubre
la **configuración de proveedores LLM** y cómo personalizarlos.

➡️ **[05-configuracion.md](05-configuracion.md)**

---

## Referencias

| Componente | Archivo | Líneas |
|------------|---------|--------|
| Motor RAG | `api/rag.py` | 1-445 |
| Chat API | `api/simple_chat.py` | 438-557 |
| WebSocket | `api/websocket_wiki.py` | - |
| Prompts | `api/prompts.py` | 31-57 |
| Frontend Ask | `src/components/Ask.tsx` | - |
| FAISS | `api/rag.py` | 383-391 |
| Context format | `api/simple_chat.py` | 206-224 |
