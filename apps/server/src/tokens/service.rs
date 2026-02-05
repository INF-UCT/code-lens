use crate::{
    shared::{AppResult, JsonWebTokenService},
    tokens::{GenerateTokenDto, Token, TokenClaims, TokensRepository},
};

use chrono::{Duration, Utc};
use serde::Deserialize;
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "tokens")]
pub struct TokensConfig {
    pub secret: String,
}

#[injectable]
pub struct TokensService {
    config: TokensConfig,
    jwt_service: Arc<JsonWebTokenService>,
    tokens_repository: Arc<TokensRepository>,
}

impl TokensService {
    pub fn generate(&self, input: &GenerateTokenDto) -> AppResult<Token> {
        let now = Utc::now();
        let id = Uuid::new_v4();

        let claims = TokenClaims {
            id,
            exp: (now + Duration::days(12 * 30)).timestamp(),
        };

        let token_str = self
            .jwt_service
            .encode(&claims, self.config.secret.as_ref())?;

        Ok(Token {
            id,
            user_id: input.user_id,
            value: token_str,
            repository_url: input.repository_url.clone(),
            created_at: now,
        })
    }

    pub fn decode(&self, token: &String) -> AppResult<TokenClaims> {
        self.jwt_service.decode(token, self.config.secret.as_ref())
    }
}
