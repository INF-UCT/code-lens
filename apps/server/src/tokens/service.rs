use crate::{
    shared::{AppError, AppResult, JsonWebTokenService},
    tokens::{RegisterTokenDto, Token, TokenClaims},
};

use chrono::{Duration, Utc};
use serde::Deserialize;
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "jsonwebtoken")]
pub struct JwtConfig {
    pub secret: String,
}

#[injectable]
pub struct TokensService {
    config: JwtConfig,
    jwt_service: Arc<JsonWebTokenService>,
}

impl TokensService {
    pub fn generate(&self, input: &RegisterTokenDto) -> AppResult<Token> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let claims = TokenClaims {
            id: id.to_string(),
            repository_url: input.repository_url.clone(),
            expiration_months: input.expiration_months as i64,
            exp: (now + Duration::days(input.expiration_months as i64 * 30)).timestamp(),
        };

        let token_str = self
            .jwt_service
            .encode(&claims, self.config.secret.as_ref())?;

        Ok(Token {
            id,
            value: token_str,
            repository_url: input.repository_url.clone(),
            refresh_count: 0,
            created_at: now,
        })
    }

    pub fn refresh(&self, token_str: &String) -> AppResult<Token> {
        let decoded = self
            .jwt_service
            .decode::<TokenClaims>(token_str, self.config.secret.as_ref())?;

        let now = Utc::now();
        let new_exp = now + Duration::days(decoded.expiration_months * 30);

        let new_claims = TokenClaims {
            id: decoded.id,
            repository_url: decoded.repository_url,
            expiration_months: decoded.expiration_months,
            exp: new_exp.timestamp(),
        };

        let new_token_str = self
            .jwt_service
            .encode(&new_claims, self.config.secret.as_ref())?;

        let uuid = Uuid::parse_str(&new_claims.id)
            .map_err(|_| AppError::BadRequest("Invalid UUID in token".to_string()))?;

        Ok(Token {
            id: uuid,
            value: new_token_str,
            repository_url: new_claims.repository_url,
            refresh_count: 0,
            created_at: now,
        })
    }
}
