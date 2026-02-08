use crate::mailer::{Mail, Mailer, TemplateRenderer};
use bon::Builder;
use reqwest::Client as HttpClient;
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;

#[derive(Clone, Builder)]
pub struct EventHandler {
    mailer: Mailer,
}

impl EventHandler {
    pub async fn init_docs_generation(
        &self,
        repo_id: Uuid,
        repo_path: PathBuf,
        owner_email: String,
    ) {
        tracing::info!("Handling repo_id={}", repo_id.to_string());

        let email_data = Mail::builder()
            .to(owner_email)
            .subject(format!(
                "Documentation generation started for repository {}",
                repo_id
            ))
            .html(TemplateRenderer::render("doc-gen", &HashMap::new()))
            .build();

        self.mailer.send(email_data).await.unwrap_or_else(|err| {
            tracing::error!("Failed to send email: {}", err);
        });

        HttpClient::new()
            .post("http://code-lens-wiki:3000/docs-gen")
            .json(&serde_json::json!({
                "repo_id": repo_id,
                "repo_path": repo_path.to_str().unwrap_or_default(),
            }))
            .send()
            .await
            .inspect_err(|err| {
                tracing::error!("Failed to send HTTP request: {}", err);
            })
            .ok();

        // tracing::info!(
        //     "Removing cloned repository at {}",
        //     repo_path.to_str().unwrap_or_default()
        // );

        // fs::remove_dir_all(&repo_path).await.unwrap_or_else(|err| {
        //     tracing::error!(
        //         "Failed to remove directory {}: {}",
        //         repo_path.to_str().unwrap_or_default(),
        //         err
        //     );
        // });
    }
}
