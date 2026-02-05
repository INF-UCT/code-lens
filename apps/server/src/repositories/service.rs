use crate::{
    repositories::{AnalyzeRepositoryDto, RepositoriesRepository, Repository, RepositoryError},
    shared::{AppResult, Event, EventQueue},
    users::User,
};

use git2::{Oid, Repository as GitRepository};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Arc};
use sword::prelude::*;
use tokio::fs;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[config(key = "repositories")]
pub struct RepositoriesConfig {
    pub clone_dir: String,
    pub ignore_patterns: String,
    pub max_folder_size_mb: u64,
    pub max_files_per_folder: usize,
    pub max_file_size_mb: u64,
}

#[injectable]
pub struct RepositoriesService {
    config: RepositoriesConfig,
    event_queue: Arc<EventQueue>,
    repository: Arc<RepositoriesRepository>,
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

        tokio::join!(
            self.event_queue.publish(Event::SendEmail),
            self.event_queue
                .publish(Event::InitDocsGen((repo.id, clone_path, owner.email)))
        );

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

        let base_dir = PathBuf::from(&format!("{}/repo-{id}", self.config.clone_dir));

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
}
