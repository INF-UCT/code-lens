mod preprocessor;

use crate::{
    repositories::*,
    shared::{AppResult, Mail, Mailer, TemplateRenderer, WikiClient},
    users::User,
};

use git2::{Oid, Repository as GitRepository};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
};
use sword::prelude::*;
use tokio::{fs, process::Command};
use uuid::Uuid;

pub use preprocessor::RepositoriesPreprocessor;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[config(key = "repositories")]
pub struct RepositoriesConfig {
    pub clone_dir: String,
    pub rignore_file_path: String,
    pub max_file_size_mb: u64,
}

#[injectable]
pub struct RepositoriesService {
    config: RepositoriesConfig,
    wiki_client: Arc<WikiClient>,
    mailer: Arc<Mailer>,
    repository: Arc<RepositoriesRepository>,
    preprocessor: Arc<RepositoriesPreprocessor>,
}

impl RepositoriesService {
    pub async fn find_all(&self) -> AppResult<Vec<Repository>> {
        self.repository.find_all().await
    }

    pub async fn generate_docs(
        &self,
        input: &AnalyzeRepositoryDto,
        owner: User,
    ) -> AppResult<Uuid> {
        let repo = self.get_or_create(&owner.id, input).await?;
        let clone_path = self.clone_to_fs(&repo).await?;

        self.preprocessor.run(&clone_path).await?;

        let mut context = HashMap::new();
        context.insert("repository_name".to_string(), repo.name.clone());

        let mail = Mail {
            to: owner.email.clone(),
            subject: format!(
                "Code Lens - Documentation Generation Started for {}",
                repo.name
            ),
            html: TemplateRenderer::render("doc-gen", &context),
        };

        let clone_path_str = clone_path.to_str().unwrap_or_default().to_string();
        let repository_tree = self.generate_repository_tree(&repo).await?;

        tracing::debug!(
            "Repository tree for {} ({} files):\n{}",
            repo.name,
            repository_tree.lines().count(),
            repository_tree
        );

        tokio::try_join!(
            self.mailer.send(mail),
            self.wiki_client
                .request_docs_gen(&repo.id, clone_path_str, repository_tree)
        )?;

        Ok(repo.id)
    }

    async fn get_or_create(
        &self,
        owner_id: &Uuid,
        input: &AnalyzeRepositoryDto,
    ) -> AppResult<Repository> {
        if let Some(repository) = self.repository.find_by_name(&input.name).await? {
            tracing::info!(
                "Repository {} already exists. Skipping creation.",
                input.name
            );

            return Ok(repository);
        }

        tracing::info!("Creating new repository {}", input.name);

        self.repository
            .save(Repository::from((owner_id, input)))
            .await
    }

    async fn clone_to_fs(&self, repo: &Repository) -> Result<PathBuf, RepositoryError> {
        let Repository {
            id,
            url,
            default_branch,
            last_commit_sha,
            ..
        } = repo;

        let base_dir = PathBuf::from(&format!("{}/{id}", self.config.clone_dir));

        if base_dir.exists() {
            tracing::info!("Removing existing repository directory: {:?}", base_dir);

            fs::remove_dir_all(&base_dir)
                .await
                .map_err(RepositoryError::from)?;
        }

        fs::create_dir_all(&base_dir)
            .await
            .map_err(RepositoryError::from)?;

        let repo = GitRepository::clone(url, &base_dir)?;

        repo.set_head(&format!("refs/heads/{default_branch}"))?;

        let oid = Oid::from_str(last_commit_sha)?;
        let object = repo.find_object(oid, None)?;

        repo.checkout_tree(&object, None)?;
        repo.set_head_detached(oid)?;

        let dir_str = base_dir.to_str().unwrap_or_default();

        tracing::info!("Completed clone {dir_str}");

        Ok(base_dir)
    }

    async fn generate_repository_tree(&self, repo: &Repository) -> AppResult<String> {
        tracing::info!("Generating repository tree for {}", repo.name);

        let repository_dir = Path::new(&self.config.clone_dir).join(repo.id.to_string());

        // rg --files \
        //   --hidden \
        //   --no-ignore \
        //   --ignore-file scripts/llm.rgignore \
        //   --glob '!.git' \
        //   | sort

        let command = format!(
            "rg --files --hidden --no-ignore --ignore-file {} --glob '!.git' | sort",
            self.config.rignore_file_path
        );

        let output = Command::new("sh")
            .arg("-c")
            .arg(&command)
            .current_dir(&repository_dir)
            .output()
            .await
            .map_err(RepositoryError::from)?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            tracing::error!("Failed to generate repository tree: {}", stderr);
            return Err(RepositoryError::Sanitization(format!(
                "Failed to generate repository tree: {}",
                stderr
            ))
            .into());
        }

        let tree = String::from_utf8_lossy(&output.stdout).to_string();

        if tree.is_empty() {
            tracing::warn!("Generated repository tree is empty for {}", repo.name);
        } else {
            tracing::debug!("Generated repository tree with {} bytes", tree.len());
        }

        Ok(tree)
    }
}
