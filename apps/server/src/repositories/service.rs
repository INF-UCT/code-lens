use crate::{
    repositories::RepositoryError,
    shared::{AppResult, EventQueue},
};
use git2::Repository as GitRepository;
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
}

impl RepositoriesService {
    pub async fn _git_clone(&self, url: &str, branch: &str) -> AppResult<PathBuf> {
        let base_dir = PathBuf::from(&format!(
            "{}/repo-{}",
            self.config.clone_dir,
            Uuid::new_v4()
        ));

        fs::create_dir_all(&base_dir)
            .await
            .map_err(RepositoryError::from)?;

        let repo = GitRepository::clone(url, &base_dir).map_err(RepositoryError::from)?;

        repo.set_head(&format!("refs/heads/{branch}"))
            .map_err(RepositoryError::from)?;

        let dir_str = base_dir.to_str().unwrap_or_default();

        tracing::info!("Competed clone {dir_str}");

        Ok(base_dir)
    }
}
