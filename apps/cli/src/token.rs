use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenClaims {
    pub sub: String,
    pub jti: String,
    pub exp: i64,
    pub iat: i64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TokenDuration {
    OneMonth,
    SixMonths,
    OneYear,
}

impl TokenDuration {
    pub fn duration(&self) -> Duration {
        match self {
            TokenDuration::OneMonth => Duration::days(30),
            TokenDuration::SixMonths => Duration::days(180),
            TokenDuration::OneYear => Duration::days(365),
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            TokenDuration::OneMonth => "1 mes",
            TokenDuration::SixMonths => "6 meses",
            TokenDuration::OneYear => "1 año",
        }
    }
}

pub fn generate_token(
    repository_url: &str,
    duration: TokenDuration,
    secret: &str,
    unique_id: Option<String>,
) -> Result<String, Box<dyn std::error::Error>> {
    let now = Utc::now();
    let expiration = now + duration.duration();
    let jti = unique_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let claims = TokenClaims {
        sub: repository_url.to_string(),
        jti,
        exp: expiration.timestamp(),
        iat: now.timestamp(),
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )?;

    Ok(token)
}

pub fn decode_token(token: &str, secret: &str) -> Result<TokenClaims, String> {
    let token_data = decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(secret.as_ref()),
        &Validation::default(),
    );

    let Ok(token_data) = token_data else {
        return Err(
            "Error al decodificar el token, asegúrate de que el token es válido.".to_string(),
        );
    };

    Ok(token_data.claims)
}

pub fn format_token_info(token: &str, repository_url: &str, duration: TokenDuration) -> String {
    format!(
        "✅ Proceso completado!\n\n\
         📦 Repositorio: {}\n\
         ⏱️  Duración: {}\n\
         🔑 Token:\n\n{}",
        repository_url,
        duration.label(),
        token
    )
}
