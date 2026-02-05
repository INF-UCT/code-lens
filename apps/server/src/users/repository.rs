use super::User;
use crate::shared::{AppResult, Database};

use sqlx::query_as as sql;
use std::sync::Arc;
use sword::prelude::*;

#[injectable]
pub struct UserRepository {
    db: Arc<Database>,
}

impl UserRepository {
    pub async fn find_by_username(&self, username: &str) -> AppResult<Option<User>> {
        let result = sql::<_, User>("SELECT * FROM users WHERE username = $1")
            .bind(username)
            .fetch_optional(self.db.get_pool())
            .await?;

        Ok(result)
    }

    pub async fn _find_by_email(&self, email: &str) -> AppResult<Option<User>> {
        let result = sql::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(email)
            .fetch_optional(self.db.get_pool())
            .await?;

        Ok(result)
    }

    pub async fn create(&self, user: &User) -> AppResult<User> {
        let result = sql::<_, User>("INSERT INTO users (id, username) VALUES ($1, $2) RETURNING *")
            .bind(user.id)
            .bind(&user.username)
            .fetch_one(self.db.get_pool())
            .await?;

        Ok(result)
    }
}
