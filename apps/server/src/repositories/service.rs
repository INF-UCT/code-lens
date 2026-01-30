use git2::Repository as GitRepository;
use jwalk::WalkDir;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use sword::prelude::*;
use tokio::fs;
use uuid::Uuid;

use crate::{repositories::RepositoryError, shared::AppResult};

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
}

impl RepositoriesService {
    pub async fn git_clone(&self, url: &str, branch: &str) -> AppResult<PathBuf> {
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

        self.sanitize_directory(&base_dir).await?;

        let dir_str = base_dir.to_str().unwrap_or_default();
        tracing::info!("Competed clone {dir_str}");

        Ok(base_dir)
    }

    async fn sanitize_directory(&self, dir: &Path) -> AppResult<()> {
        let ignore_regex = Regex::new(&format!(r"(?i)({})", self.config.ignore_patterns)).unwrap();

        let mut entries_to_remove = Vec::new();

        for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
            let path = entry.path();
            let rel_path = path.strip_prefix(dir).unwrap_or_else(|_| path.as_path());

            if ignore_regex.is_match(rel_path.to_str().unwrap_or("")) {
                entries_to_remove.push(path.to_path_buf());
                continue;
            }

            if path.is_dir() {
                let mut file_count = 0;
                let mut total_size = 0u64;
                for sub_entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
                    if sub_entry.path().is_file() {
                        file_count += 1;
                        if let Ok(metadata) = sub_entry.metadata() {
                            total_size += metadata.len();
                        }
                    }
                }
                if total_size > self.config.max_folder_size_mb * 1024 * 1024
                    || file_count > self.config.max_files_per_folder
                {
                    entries_to_remove.push(path.to_path_buf());
                }
            } else if let Ok(metadata) = entry.metadata() {
                if metadata.len() > self.config.max_file_size_mb * 1024 * 1024 {
                    entries_to_remove.push(path.to_path_buf());
                }
            }
        }

        for path in entries_to_remove {
            if path.is_dir() {
                fs::remove_dir_all(&path)
                    .await
                    .map_err(RepositoryError::from)?;
            } else {
                fs::remove_file(&path)
                    .await
                    .map_err(RepositoryError::from)?
            }
        }

        Ok(())
    }
}
