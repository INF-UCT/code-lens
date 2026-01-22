use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Token {
    pub id: Uuid,
    pub value: String,
    pub repository_url: String,
    pub refresh_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenClaims {
    pub id: String,
    pub repository_url: String,
    pub expiration_months: i64,
    pub exp: i64,
}

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct RegisterTokenDto {
    #[validate(url)]
    pub repository_url: String,

    #[validate(custom(function = validate_exp_months))]
    pub expiration_months: u8,
}

fn validate_exp_months(months: u8) -> Result<(), ValidationError> {
    match months {
        1 | 6 | 12 => Ok(()),
        _ => Err(ValidationError::new(
            "Invalid duration months. Must be 1, 6, or 12.",
        )),
    }
}
