use crate::agents::planner::PlannerAgent;
use crate::agents::writer::WriterAgent;
use crate::config::AppConfig;
use crate::docs::DocumentationGenerator;
use crate::error::ApiError;
use crate::llm::LlmClient;
use crate::models::{DocGenerationInput, DocGenerationResponse};
use crate::prompts::PromptStore;
use crate::rag::RagEngine;
use crate::rag::qdrant::QdrantClient;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::http::header::AUTHORIZATION;
use axum::response::IntoResponse;
use axum::{
    Json, Router,
    routing::{get, post},
};
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Clone)]
pub struct AppState {
    config: Arc<AppConfig>,
    planner: PlannerAgent,
    rag: RagEngine,
    docs_generator: DocumentationGenerator,
}

impl AppState {
    pub async fn new(config: Arc<AppConfig>) -> anyhow::Result<Self> {
        let prompts = PromptStore::load(&config.prompts_dir).await?;
        let llm = LlmClient::new(config.ollama_url.clone());
        llm.check_connection().await?;

        let planner = PlannerAgent::new(llm.clone(), prompts.clone());
        let writer = WriterAgent::new(llm.clone(), prompts);

        let qdrant = QdrantClient::new(config.qdrant_url.clone());
        let rag = RagEngine::new(qdrant, llm);
        let docs_generator = DocumentationGenerator::new(writer, rag.clone());

        Ok(Self {
            config,
            planner,
            rag,
            docs_generator,
        })
    }
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/docs-gen", post(docs_gen))
        .route("/health", get(health))
        .with_state(state)
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn docs_gen(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<DocGenerationInput>,
) -> Result<Json<DocGenerationResponse>, ApiError> {
    validate_api_key(&state.config, &headers)?;

    validate_payload(&payload)?;

    info!(repo_id = %payload.repo_id, "planner started");
    let planner_output = state
        .planner
        .run(&payload.repo_path, &payload.repo_tree)
        .await
        .map_err(|error| ApiError::internal(format!("Planner failed: {error}")))?;

    info!(repo_id = %payload.repo_id, "indexation started");
    state
        .rag
        .new_indexation(payload.repo_id, std::path::Path::new(&payload.repo_path))
        .await
        .map_err(|error| ApiError::internal(format!("Indexation failed: {error}")))?;

    info!(repo_id = %payload.repo_id, "markdown generation started");
    state
        .docs_generator
        .clone()
        .generate(
            &state.config.wiki_output_dir,
            payload.repo_id,
            planner_output,
        )
        .await
        .map(|result| {
            let has_errors = !result.errors.is_empty();
            if has_errors {
                warn!(
                    repo_id = %payload.repo_id,
                    count = result.errors.len(),
                    "documentation generated with partial errors"
                );
            } else {
                info!(repo_id = %payload.repo_id, "documentation generated successfully");
            }

            Json(DocGenerationResponse {
                repo_id: payload.repo_id,
                message: if has_errors {
                    "Documentation generated with partial failures".to_string()
                } else {
                    "Documentation generated successfully".to_string()
                },
                generated_pages: result.generated_pages,
                output_path: result.output_dir.to_string_lossy().to_string(),
                errors: result.errors,
            })
        })
        .map_err(|error| {
            error!(repo_id = %payload.repo_id, "docs generation failed: {error}");
            ApiError::internal(format!("Documentation generation failed: {error}"))
        })
}

fn validate_api_key(config: &AppConfig, headers: &HeaderMap) -> Result<(), ApiError> {
    let header = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| ApiError::unauthorized("Missing Authorization header"))?;

    let token = header.strip_prefix("Bearer ").unwrap_or_default().trim();
    if token.is_empty() || token != config.wiki_service_api_key {
        return Err(ApiError::unauthorized("Invalid API key"));
    }

    Ok(())
}

fn validate_payload(payload: &DocGenerationInput) -> Result<(), ApiError> {
    if payload.repo_path.trim().is_empty() {
        return Err(ApiError::bad_request("repoPath cannot be empty"));
    }

    if payload.repo_tree.trim().is_empty() {
        return Err(ApiError::bad_request("repoTree cannot be empty"));
    }

    Ok(())
}
