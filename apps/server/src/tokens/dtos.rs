use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Token {
    pub id: Uuid,
    pub user_id: Uuid,
    pub value: String,
    pub repository_url: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenClaims {
    pub id: Uuid,
    pub exp: i64,
}

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct GenerateTokenDto {
    pub user_id: Uuid,

    #[validate(url)]
    pub repository_url: String,
}
