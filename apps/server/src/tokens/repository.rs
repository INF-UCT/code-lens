use crate::{
    shared::{AppResult, Database},
    tokens::Token,
};
use chrono::Utc;
use std::sync::Arc;
use sword::prelude::*;

#[injectable]
pub struct TokensRepository {
    database: Arc<Database>,
}

impl TokensRepository {
    pub async fn save(&self, token: &Token) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO tokens (id, value, repository_url, refresh_count, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                value = EXCLUDED.value,
                repository_url = EXCLUDED.repository_url,
                refresh_count = EXCLUDED.refresh_count,
                created_at = EXCLUDED.created_at,
                updated_at = EXCLUDED.updated_at",
        )
        .bind(token.id)
        .bind(&token.value)
        .bind(&token.repository_url)
        .bind(token.refresh_count)
        .bind(token.created_at)
        .bind(Utc::now())
        .execute(self.database.get_pool())
        .await?;

        Ok(())
    }
}
