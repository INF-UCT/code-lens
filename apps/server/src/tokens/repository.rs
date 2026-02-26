use crate::{
    shared::{AppResult, Database},
    tokens::Token,
};
use chrono::Utc;
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[derive(Clone, Debug, sqlx::FromRow)]
#[allow(dead_code)]
pub struct RevokedToken {
    pub id: Uuid,
    pub token_hash: String,
    pub revoked_at: chrono::DateTime<Utc>,
}

#[injectable]
pub struct TokensRepository {
    database: Arc<Database>,
}

impl TokensRepository {
    pub async fn find_by_id(&self, id: &Uuid) -> AppResult<Option<Token>> {
        let token = sqlx::query_as::<_, Token>("SELECT * FROM tokens WHERE id = $1")
            .bind(id)
            .fetch_optional(self.database.get_pool())
            .await?;

        Ok(token)
    }

    pub async fn save(&self, token: &Token) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO tokens (id, user_id, value, repository_url, created_at)
            VALUES ($1, $2, $3, $4, $5)",
        )
        .bind(token.id)
        .bind(token.user_id)
        .bind(&token.value)
        .bind(&token.repository_url)
        .bind(token.created_at)
        .execute(self.database.get_pool())
        .await?;

        Ok(())
    }

    pub async fn find_by_user_id(&self, user_id: &Uuid) -> AppResult<Vec<Token>> {
        let tokens = sqlx::query_as("SELECT * FROM tokens WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(self.database.get_pool())
            .await?;

        Ok(tokens)
    }

    pub async fn is_token_revoked(&self, token_hash: &str) -> AppResult<bool> {
        let result = sqlx::query_as::<_, RevokedToken>(
            "SELECT * FROM revoked_tokens WHERE token_hash = $1",
        )
        .bind(token_hash)
        .fetch_optional(self.database.get_pool())
        .await?;

        Ok(result.is_some())
    }

    pub async fn revoke_token(&self, token_hash: &str) -> AppResult<()> {
        sqlx::query("INSERT INTO revoked_tokens (token_hash) VALUES ($1)")
            .bind(token_hash)
            .execute(self.database.get_pool())
            .await?;

        Ok(())
    }
}
