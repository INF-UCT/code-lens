use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Token {
    pub id: Uuid,
    pub token: String,
    pub repository_url: String,
    pub refresh_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct RegisterTokenDto {
    pub repository_url: String,
    pub expiration_months: DurationMonths,
}

#[derive(Clone, Debug, Deserialize)]
pub enum DurationMonths {
    One = 1,
    Six = 6,
    Twelve = 12,
}
