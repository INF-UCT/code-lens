use super::Repository;
use crate::shared::{AppResult, Database};
use sqlx::query_as as sqlx;
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[injectable]
pub struct RepositoriesRepository {
    db: Arc<Database>,
}

impl RepositoriesRepository {
    pub async fn find_all(&self) -> AppResult<Vec<Repository>> {
        let results = sqlx::<_, Repository>("SELECT * FROM repositories ORDER BY created_at DESC")
            .fetch_all(self.db.get_pool())
            .await?;

        Ok(results)
    }

    pub async fn _find_by_id(&self, id: Uuid) -> AppResult<Option<Repository>> {
        let result = sqlx::<_, Repository>("SELECT * FROM repositories WHERE id = $1")
            .bind(id)
            .fetch_optional(self.db.get_pool())
            .await?;

        Ok(result)
    }

    pub async fn find_by_name(&self, name: &str) -> AppResult<Option<Repository>> {
        let result = sqlx::<_, Repository>("SELECT * FROM repositories WHERE name = $1")
            .bind(name)
            .fetch_optional(self.db.get_pool())
            .await?;

        Ok(result)
    }

    pub async fn save(&self, repository: Repository) -> AppResult<Repository> {
        let result = sqlx::<_, Repository>(
            "INSERT INTO repositories (id, name, url, owner_id, last_commit_sha, default_branch, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (name) DO UPDATE SET
                url = EXCLUDED.url,
                last_commit_sha = EXCLUDED.last_commit_sha,
                updated_at = EXCLUDED.updated_at
             RETURNING *"
        )
        .bind(repository.id)
        .bind(&repository.name)
        .bind(&repository.url)
        .bind(repository.owner_id)
        .bind(&repository.last_commit_sha)
        .bind(&repository.default_branch)
        .bind(repository.created_at)
        .bind(repository.updated_at)
        .fetch_one(self.db.get_pool())
        .await?;

        Ok(result)
    }
}
