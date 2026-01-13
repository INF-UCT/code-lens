use crate::common::AppError;
use axum_config::config;
use chrono::{Duration, Utc};
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "jsonwebtoken")]
pub struct JwtConfig {
    pub secret: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub id: String,
    pub repository_url: String,
    pub expiration_months: i64,
    pub exp: i64,
}

pub async fn generate_token(
    repository_url: &String,
    expiration_months: i64,
    secret: &String,
) -> Result<(Uuid, String), AppError> {
    let id = Uuid::new_v4();
    let now = Utc::now();

    let claims = Claims {
        id: id.to_string(),
        repository_url: repository_url.clone(),
        expiration_months,
        exp: (now + Duration::days(expiration_months * 30)).timestamp(),
    };

    let token = jsonwebtoken::encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )?;

    Ok((id, token))
}

pub async fn decode_token(token: &String, secret: &String) -> Result<Claims, AppError> {
    let decoded = jsonwebtoken::decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    )?;

    Ok(decoded.claims)
}

pub async fn refresh_token(token: &String, secret: &String) -> Result<(Uuid, String), AppError> {
    let decoded = decode_token(token, secret).await?;

    let now = Utc::now();
    let new_exp = now + Duration::days(decoded.expiration_months * 30);

    let new_claims = Claims {
        id: decoded.id,
        repository_url: decoded.repository_url,
        expiration_months: decoded.expiration_months,
        exp: new_exp.timestamp(),
    };

    let new_token = jsonwebtoken::encode(
        &Header::default(),
        &new_claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )?;

    let uuid = Uuid::parse_str(&new_claims.id)
        .map_err(|_| AppError::BadRequest("Invalid UUID in token".to_string()))?;

    Ok((uuid, new_token))
}
