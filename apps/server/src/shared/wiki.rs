use serde::Deserialize;
use serde_json::json;
use sword::prelude::*;
use uuid::Uuid;

use crate::shared::AppResult;
use crate::shared::errors::AppError;

#[derive(Debug, Clone, Deserialize)]
#[config(key = "wiki")]
pub struct WikiConfig {
    pub service_url: String,
    pub api_key: String,
}

#[injectable(provider)]
pub struct WikiClient {
    http_client: reqwest::Client,
    config: WikiConfig,
}

impl WikiClient {
    pub fn new(config: WikiConfig) -> Self {
        Self {
            config,
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn request_docs_gen(
        &self,
        repository_id: &Uuid,
        repository_clone_path: String,
        repository_tree: String,
    ) -> AppResult<()> {
        let url = format!("{}/docs-gen", self.config.service_url);

        let body = json!({
            "repo_id": repository_id.to_string(),
            "repo_path": repository_clone_path,
            "file_tree": repository_tree,
        });

        let response = self
            .http_client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .body(body.to_string())
            .send()
            .await
            .map_err(|e| {
                tracing::error!("Failed to send docs-gen request to wiki service: {e}");
                AppError::WikiService(format!("Request failed: {e}"))
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_body: String = response.text().await.unwrap_or_default();
            tracing::error!("Wiki service returned error {status}: {error_body}");
            return Err(AppError::WikiService(format!(
                "HTTP {status}: {error_body}"
            )));
        }

        tracing::info!("Successfully requested docs generation for repository {repository_id}");
        Ok(())
    }
}
