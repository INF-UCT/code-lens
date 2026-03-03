# Configuración y Proveedores LLM

## Personalización del Sistema

DeepWiki soporta múltiples proveedores de LLM y embeddings. Esta sección explica cómo configurarlos y cómo añadir nuevos proveedores.

**Archivos de configuración:**
- `api/config/generator.json` - Modelos LLM
- `api/config/embedder.json` - Modelos de embeddings
- `api/config/repo.json` - Filtros de archivos
- `.env` - Variables de entorno

---

## 1. Configuración de Proveedores LLM

### Archivo: api/config/generator.json

```json
{
    "providers": {
        "google": {
            "models": [
                {
                    "name": "gemini-2.5-flash",
                    "type": "chat",
                    "temperature": 0.7,
                    "top_p": 0.95,
                    "top_k": 40
                },
                {
                    "name": "gemini-2.5-pro",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "gemini-2.5-flash"
        },
        
        "openai": {
            "models": [
                {
                    "name": "gpt-5-nano",
                    "type": "chat",
                    "temperature": 0.7
                },
                {
                    "name": "gpt-4o",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "gpt-5-nano"
        },
        
        "openrouter": {
            "models": [
                {
                    "name": "openai/gpt-5-nano",
                    "type": "chat",
                    "temperature": 0.7
                },
                {
                    "name": "anthropic/claude-3.5-sonnet",
                    "type": "chat",
                    "temperature": 0.7
                },
                {
                    "name": "meta-llama/llama-3.1-70b-instruct",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "openai/gpt-5-nano"
        },
        
        "ollama": {
            "models": [
                {
                    "name": "qwen3:1.7b",
                    "type": "chat",
                    "num_ctx": 8192,
                    "options": {
                        "temperature": 0.7
                    }
                },
                {
                    "name": "llama3:8b",
                    "type": "chat",
                    "num_ctx": 8192
                }
            ],
            "default_model": "qwen3:1.7b"
        },
        
        "bedrock": {
            "models": [
                {
                    "name": "anthropic.claude-3-sonnet",
                    "type": "chat",
                    "temperature": 0.7
                },
                {
                    "name": "amazon.titan-text-express-v1",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "anthropic.claude-3-sonnet"
        },
        
        "azure": {
            "models": [
                {
                    "name": "gpt-4o",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "gpt-4o"
        },
        
        "dashscope": {
            "models": [
                {
                    "name": "qwen-plus",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "qwen-plus"
        }
    }
}
```

### Parámetros de Modelo

| Parámetro | Descripción | Rango |
|-----------|-------------|-------|
| `temperature` | Creatividad de respuestas | 0.0 - 1.0 |
| `top_p` | Nucleus sampling | 0.0 - 1.0 |
| `top_k` | Top-k sampling (Google) | Entero |
| `num_ctx` | Ventana de contexto (Ollama) | Entero |
| `max_tokens` | Máximo tokens de respuesta | Entero |

---

## 2. Configuración de Embeddings

### Archivo: api/config/embedder.json

```json
{
    "providers": {
        "openai": {
            "model": "text-embedding-3-small",
            "dimensions": 256,
            "batch_size": 500
        },
        
        "google": {
            "model": "gemini-embedding-001",
            "batch_size": 100
        },
        
        "ollama": {
            "model": "nomic-embed-text",
            "batch_size": 1
        },
        
        "bedrock": {
            "model": "amazon.titan-embed-text-v2:0",
            "dimensions": 256,
            "batch_size": 100
        }
    },
    
    "text_splitter": {
        "split_by": "word",
        "chunk_size": 350,
        "chunk_overlap": 100
    },
    
    "retriever": {
        "top_k": 20
    }
}
```

### Selección de Embedder

```python
# Variable de entorno
DEEPWIKI_EMBEDDER_TYPE=openai  # openai, google, ollama, bedrock
```

---

## 3. Variables de Entorno

### Archivo: .env

```
# ============================================
# PROVEEDORES LLM - API KEYS
# ============================================

# Google (Gemini)
GOOGLE_API_KEY=tu_google_api_key

# OpenAI (GPT-4, GPT-5)
OPENAI_API_KEY=tu_openai_api_key

# OpenRouter (Claude, Llama, Mistral)
OPENROUTER_API_KEY=tu_openrouter_api_key

# Azure OpenAI
AZURE_OPENAI_API_KEY=tu_azure_key
AZURE_OPENAI_ENDPOINT=https://tu-recurso.openai.azure.com/
AZURE_OPENAI_VERSION=2024-02-01

# AWS Bedrock
AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_REGION=us-east-1
# Opcional:
AWS_SESSION_TOKEN=...
AWS_ROLE_ARN=arn:aws:iam::...

# ============================================
# CONFIGURACIÓN
# ============================================

# Tipo de embedder (openai, google, ollama, bedrock)
DEEPWIKI_EMBEDDER_TYPE=openai

# Directorio de configuración personalizado
# DEEPWIKI_CONFIG_DIR=/ruta/a/config

# Autenticación del wiki
# DEEPWIKI_AUTH_MODE=true
# DEEPWIKI_AUTH_CODE=tu_codigo

# Ollama (si no es local)
# OLLAMA_HOST=http://localhost:11434

# Puerto del servidor (override)
# PORT=8001
```

### Dónde Obtener las Keys

| Proveedor | URL |
|-----------|-----|
| **Google AI** | https://makersuite.google.com/app/apikey |
| **OpenAI** | https://platform.openai.com/api-keys |
| **OpenRouter** | https://openrouter.ai/settings/keys |
| **Azure** | https://portal.azure.com (Azure OpenAI) |
| **AWS** | https://console.aws.amazon.com/iam/ |

---

## 4. Implementación de Clientes LLM

### Estructura de Cliente

Cada proveedor implementa una clase cliente:

```
api/
├── openai_client.py      # OpenAI
├── openrouter_client.py # OpenRouter  
├── google_client.py      # Google Gemini
├── azureai_client.py    # Azure OpenAI
├── bedrock_client.py     # AWS Bedrock
├── ollama_client.py      # Ollama local
└── dashscope_client.py  # Alibaba Cloud
```

### Ejemplo: Cliente OpenAI

```python
# api/openai_client.py
from openai import AsyncOpenAI
from adalflow.core.model_client import ModelClient

class OpenAIClient(ModelClient):
    def __init__(self, api_key: str = None, **kwargs):
        self.api_key = api_key
        self.model = kwargs.get("model", "gpt-4")
        
    def init_async_client(self):
        return AsyncOpenAI(api_key=self.api_key)
    
    async def acall(self, prompt: str, stream: bool = True):
        client = self.init_async_client()
        
        if stream:
            return await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                stream=True
            )
        else:
            return await client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "prompt"}]
            )
    
    def parse_chat_completion(self, response):
        return response.choices[0].message.content
```

### Ejemplo: Cliente Ollama

```python
# api/ollama_client.py (basado en el código real)
import aiohttp
from adalflow.core.model_client import ModelClient

class OllamaClient(ModelClient):
    def __init__(self, model: str = "llama3", **kwargs):
        self.model = model
        self.base_url = kwargs.get("base_url", "http://localhost:11434")
        
    async def acall(self, prompt: str, stream: bool = True):
        async with aiohttp.ClientSession() as session:
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": stream
            }
            
            async with session.post(
                f"{self.base_url}/api/chat",
                json=payload
            ) as response:
                if stream:
                    async def generate():
                        async for line in response.content:
                            if line:
                                data = json.loads(line)
                                yield data["message"]["content"]
                    return generate()
                else:
                    result = await response.json()
                    return result["message"]["content"]
```

---

## 5. Filtros de Repositorio

### Archivo: api/config/repo.json

```json
{
    "file_filters": {
        "excluded_dirs": [
            ".git",
            "node_modules", 
            "__pycache__",
            "venv",
            ".venv",
            "dist",
            "build",
            ".next",
            "out"
        ],
        
        "excluded_files": [
            "package-lock.json",
            "yarn.lock",
            "*.min.js",
            "*.map",
            ".DS_Store"
        ],
        
        "included_dirs": [],
        
        "included_files": []
    },
    
    "max_file_size": {
        "code": 81920,
        "docs": 8192
    }
}
```

### Modos de Filtrado

#### Modo Exclusión (Default)

```python
excluded_dirs = [".git", "node_modules", ...]
# Procesar todo EXCEPTO estos directorios
```

#### Modo Inclusión

```python
included_dirs = ["src/", "lib/"]
included_files = ["*.py", "*.ts"]
# SOLO procesar estos directorios/archivos
```

---

## 6. Sistema de Configuración

### Loader de Configuración

```python
# api/config.py
import json
import os

def load_json_config(filename: str):
    config_dir = os.getenv("DEEPWIKI_CONFIG_DIR", "api/config")
    filepath = os.path.join(config_dir, filename)
    
    with open(filepath, "r") as f:
        return json.load(f)

def get_generator_config():
    return load_json_config("generator.json")

def get_embedder_config():
    return load_json_config("embedder.json")

def get_repo_config():
    return load_json_config("repo.json")
```

### Variables de Entorno en Config

Soporta `${VAR_NAME}` en JSON:

```json
{
    "providers": {
        "google": {
            "api_key": "${GOOGLE_API_KEY}"
        }
    }
}
```

```python
# Reemplazo automático
import os
import re

def resolve_env_vars(config):
    if isinstance(config, dict):
        return {k: resolve_env_vars(v) for k, v in config.items()}
    elif isinstance(config, list):
        return [resolve_env_vars(item) for item in config]
    elif isinstance(config, str):
        # Reemplazar ${VAR} con os.environ[VAR]
        return re.sub(r'\$\{(\w+)\}', 
                      lambda m: os.environ.get(m.group(1), ""), 
                      config)
    return config
```

---

## 7. Añadir un Nuevo Proveedor

### Paso 1: Crear Cliente

```python
# api/nuevo_proveedor_client.py
from adalflow.core.model_client import ModelClient

class NuevoProveedorClient(ModelClient):
    def __init__(self, api_key: str = None, **kwargs):
        self.api_key = api_key
        self.model = kwargs.get("model", "model-default")
        
    # Implementar métodos requeridos
    def init_sync_client(self):
        ...
        
    def init_async_client(self):
        ...
        
    def convert_inputs_to_api_kwargs(self, ...):
        ...
        
    async def acall(self, ...):
        ...
        
    def parse_chat_completion(self, ...):
        ...
```

### Paso 2: Registrar en Factory

```python
# api/config.py
CLIENT_CLASSES = {
    "google": GoogleGenAIClient,
    "openai": OpenAIClient,
    "openrouter": OpenRouterClient,
    "ollama": OllamaClient,
    "bedrock": BedrockClient,
    "azure": AzureAIClient,
    "dashscope": DashscopeClient,
    "nuevo_proveedor": NuevoProveedorClient,  # Añadir aquí
}

def get_client(provider: str, model: str = None):
    config = get_generator_config()
    provider_config = config["providers"].get(provider)
    
    model_config = provider_config["models"][0]
    if model:
        model_config = next(
            (m for m in provider_config["models"] if m["name"] == model),
            model_config
        )
    
    client_class = CLIENT_CLASSES[provider]
    return client_class(**model_config)
```

### Paso 3: Añadir Configuración

```json
// api/config/generator.json
{
    "providers": {
        "nuevo_proveedor": {
            "models": [
                {
                    "name": "model-name",
                    "type": "chat",
                    "temperature": 0.7
                }
            ],
            "default_model": "model-name"
        }
    }
}
```

---

## 8. Resumen de Proveedores

| Proveedor | Embedding | LLM | Uso Principal |
|-----------|-----------|-----|---------------|
| **OpenAI** | text-embedding-3-small | GPT-4/5 | Mejor calidad, más caro |
| **Google** | gemini-embedding-001 | Gemini | Balance costo/calidad |
| **OpenRouter** | Varía | Claude, Llama | Modelos diversos, económico |
| **Ollama** | nomic-embed-text | Llama3, Qwen | Local, privacidad |
| **Bedrock** | Titan | Claude (AWS) | Enterprise, AWS |
| **Azure** | text-embedding-3-small | GPT-4 | Enterprise, compliance |
| **Dashscope** | text-embedding-v3 | Qwen | Chino, económico |

---

## 9. Recomendaciones de Uso

### Para Desarrollo Local

```bash
# Ollama (gratis, local)
DEEPWIKI_EMBEDDER_TYPE=ollama
OLLAMA_HOST=http://localhost:11434
```

### Para Mejor Calidad

```bash
# OpenAI (mejor calidad)
DEEPWIKI_EMBEDDER_TYPE=openai
OPENAI_API_KEY=sk-...
```

### Para Mejor Costo

```bash
# OpenRouter con modelos económicos
OPENROUTER_API_KEY=sk-or-...
# Configurar en generator.json usar modelos como:
# - openai/gpt-4o-mini
# - anthropic/claude-3-haiku
```

### Para Enterprise

```bash
# Azure o Bedrock
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...

# O
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

---

## Siguiente Paso

Has completado la guía técnica. Ahora tienes una comprensión completa
del sistema para implementar tu propia versión.

➡️ **[README.md](README.md)** - Índice principal

---

## Referencias

| Componente | Archivo |
|------------|---------|
| Config LLM | `api/config/generator.json` |
| Config Embedder | `api/config/embedder.json` |
| Config Repo | `api/config/repo.json` |
| Loader | `api/config.py` |
| OpenAI Client | `api/openai_client.py` |
| Ollama Client | `api/ollama_patch.py` |
| Bedrock Client | `api/bedrock_client.py` |
