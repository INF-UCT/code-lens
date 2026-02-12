use crate::repositories::{RepositoriesConfig, RepositoryError};
use async_walkdir::WalkDir;
use futures::StreamExt;
use globset::{Glob, GlobSet, GlobSetBuilder};
use std::path::{Path, PathBuf};
use sword::prelude::*;
use tokio::fs;

const BYTES_PER_MB: u64 = 1024 * 1024;

#[injectable]
pub struct RepositoriesPreprocessor {
    config: RepositoriesConfig,
}

impl RepositoriesPreprocessor {
    pub async fn run(&self, repo_path: &PathBuf) -> Result<(), RepositoryError> {
        tracing::info!("Starting repository preprocessing: {}", repo_path.display());

        self.validate_path_exists(repo_path).await?;

        let ignore_patterns = self.load_ignore_patterns(repo_path).await?;

        self.remove_ignored_files(repo_path, &ignore_patterns)
            .await?;

        self.validate_file_sizes(repo_path).await?;

        tracing::info!(
            "Repository preprocessing completed successfully: {}",
            repo_path.display()
        );

        Ok(())
    }

    async fn validate_path_exists(&self, repo_path: &Path) -> Result<(), RepositoryError> {
        if !repo_path.exists() {
            return Err(RepositoryError::Sanitization(format!(
                "Repository path does not exist: {}",
                repo_path.display()
            )));
        }

        Ok(())
    }

    /// Carga y compila los patrones de archivos a ignorar
    ///
    /// Combina patrones de dos fuentes:
    /// 1. `.rignore` global (configuración del servidor)
    /// 2. `.code-lens-ignore` del repositorio (opcional, específico del proyecto)
    ///
    /// Los patrones siguen la sintaxis de glob. Las líneas vacías y las que empiezan
    /// con '#' son ignoradas como comentarios.
    async fn load_ignore_patterns(&self, repo_path: &Path) -> Result<GlobSet, RepositoryError> {
        let mut builder = GlobSetBuilder::new();
        let global_ignore_path = &self.config.rignore_file_path;

        tracing::debug!("Loading global ignore patterns from: {global_ignore_path}");

        self.load_patterns_from_file(global_ignore_path, &mut builder, true)
            .await?;

        let repo_ignore_path = repo_path.join(".code-lens-ignore");

        if repo_ignore_path.exists() {
            tracing::debug!(
                "Loading repository-specific ignore patterns from: {}",
                repo_ignore_path.display()
            );
            self.load_patterns_from_file(&repo_ignore_path.to_string_lossy(), &mut builder, false)
                .await?;
        }

        builder.build().map_err(|e| {
            RepositoryError::Sanitization(format!("Failed to build ignore patterns: {e}"))
        })
    }

    async fn load_patterns_from_file(
        &self,
        path: &str,
        builder: &mut GlobSetBuilder,
        required: bool,
    ) -> Result<(), RepositoryError> {
        let content = match fs::read_to_string(path).await {
            Ok(content) => content,
            Err(e) if !required => {
                tracing::debug!("Optional ignore file '{path}' not found or unreadable",);
                return Ok(());
            }
            Err(e) => {
                return Err(RepositoryError::Sanitization(format!(
                    "Failed to read required ignore file '{path}': {e}",
                )));
            }
        };

        for line in content.lines() {
            let line = line.trim();

            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let Ok(glob) = Glob::new(line) else {
                tracing::warn!("Invalid glob pattern in '{path}': '{line}'");
                continue;
            };

            tracing::debug!("Adding ignore pattern: '{line}'");
            builder.add(glob);
        }

        Ok(())
    }

    async fn remove_ignored_files(
        &self,
        repo_path: &Path,
        patterns: &GlobSet,
    ) -> Result<(), RepositoryError> {
        let mut paths_to_remove = Vec::new();
        let mut entries = WalkDir::new(repo_path);

        while let Some(entry) = entries.next().await {
            let entry = entry.map_err(|e| {
                RepositoryError::Sanitization(format!("Error walking directory: {e}"))
            })?;

            let path = entry.path();

            if path == repo_path {
                continue;
            }

            let should_remove = self.should_ignore_path(repo_path, &path, patterns);

            if should_remove {
                paths_to_remove.push(path.to_path_buf());
            }
        }

        paths_to_remove.reverse();

        for path in paths_to_remove {
            tracing::debug!("Removing ignored path: {}", path.display());
            self.remove_path(&path).await?;
        }

        Ok(())
    }

    fn should_ignore_path(&self, repo_root: &Path, path: &Path, patterns: &GlobSet) -> bool {
        if let Ok(relative_path) = path.strip_prefix(repo_root) {
            if patterns.is_match(relative_path) {
                tracing::debug!("Pattern match for path: {}", relative_path.display());
                return true;
            }

            let path_str = relative_path.to_string_lossy();

            let with_slash = format!("{}/", path_str);
            if patterns.is_match(with_slash.as_str()) {
                tracing::debug!("Pattern match for path with slash: {}", path_str);
                return true;
            }
        }

        false
    }

    async fn remove_path(&self, path: &Path) -> Result<(), RepositoryError> {
        let metadata = fs::metadata(path).await.map_err(|e| {
            RepositoryError::Sanitization(format!(
                "Failed to get metadata for '{}': {e}",
                path.display(),
            ))
        })?;

        if metadata.is_dir() {
            fs::remove_dir_all(path).await
        } else if metadata.is_file() {
            fs::remove_file(path).await
        } else {
            Ok(())
        }
        .map_err(|e| {
            RepositoryError::Sanitization(format!(
                "Failed to remove path '{}': {e}",
                path.display(),
            ))
        })
    }

    async fn validate_file_sizes(&self, repo_path: &Path) -> Result<(), RepositoryError> {
        let mut entries = WalkDir::new(repo_path);

        while let Some(entry) = entries.next().await {
            let entry = entry.map_err(|e| {
                RepositoryError::Sanitization(format!("Error walking directory: {e}"))
            })?;

            let file_type = entry.file_type().await.map_err(|e| {
                RepositoryError::Sanitization(format!("Error getting file type: {e}"))
            })?;

            if !file_type.is_file() {
                continue;
            }

            let path = entry.path();
            let metadata = fs::metadata(&path).await.map_err(|e| {
                RepositoryError::Sanitization(format!("Error reading metadata: {e}"))
            })?;

            let file_size_bytes = metadata.len();
            let size_mb = file_size_bytes / BYTES_PER_MB;
            let max_size = self.config.max_file_size_mb;

            if size_mb > max_size {
                return Err(RepositoryError::Sanitization(format!(
                    "File '{}' exceeds maximum size: {size_mb} MB > {max_size} MB",
                    path.display(),
                )));
            }
        }

        Ok(())
    }
}
