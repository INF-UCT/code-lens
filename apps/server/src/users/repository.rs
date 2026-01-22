use super::{CreateUser, User};
use crate::shared::{AppResult, Database};

use sqlx::Postgres;
use std::sync::Arc;
use sword::prelude::*;

#[injectable]
pub struct UserRepository {
    db: Arc<Database>,
}

impl UserRepository {
    pub async fn find_by_username(&self, username: &str) -> AppResult<Option<User>> {
        let result = sqlx::query_as::<Postgres, User>(
            "SELECT id, username, dn, full_name, email, created_at, updated_at FROM users WHERE username = $1"
        )
        .bind(username)
        .fetch_optional(&*self.db.pool)
        .await?;

        Ok(result)
    }

    pub async fn create(&self, user: CreateUser) -> AppResult<User> {
        let result = sqlx::query_as::<Postgres, User>(
            "INSERT INTO users (username, dn, full_name, email) VALUES ($1, $2, $3, $4) RETURNING id, username, dn, full_name, email, created_at, updated_at"
        )
        .bind(&user.username)
        .bind(&user.dn)
        .bind(&user.full_name)
        .bind(&user.email)
        .fetch_one(&*self.db.pool)
        .await?;

        Ok(result)
    }
}
