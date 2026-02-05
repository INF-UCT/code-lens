use crate::{
    shared::{AppResult, Database},
    tokens::Token,
};
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

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
}
