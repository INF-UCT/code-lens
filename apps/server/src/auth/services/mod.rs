mod ldap;

use crate::{
    auth::{LoginDto, LoginResponse},
    shared::{AppResult, JsonWebTokenService},
    tokens::{TokensRepository, UserClaims},
    users::{User, UserRepository},
};

use chrono::{Duration, Utc};
use serde::Deserialize;
use std::sync::Arc;
use sword::prelude::*;

pub use ldap::LdapClient;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "tokens")]
pub struct TokensConfig {
    pub secret: String,
}

#[injectable]
pub struct AuthService {
    ldap: Arc<LdapClient>,
    users: Arc<UserRepository>,
    config: TokensConfig,
    jwt_service: Arc<JsonWebTokenService>,
    tokens_repository: Arc<TokensRepository>,
}

impl AuthService {
    pub async fn login(&self, input: LoginDto) -> AppResult<LoginResponse> {
        let email = self
            .ldap
            .authenticate(&input.username, &input.password)
            .await?;

        tracing::info!("LDAP authentication successful. Email: {}", email);

        let user_exists = self.users.find_by_username(&input.username).await?;

        tracing::info!("User exists: {:?}", user_exists.is_some());

        let user = match user_exists {
            Some(user) => user,
            None => {
                let new_user = User::new(input.username, email);
                self.users.create(&new_user).await?;
                tracing::info!("Created new user: {:?}", new_user);
                new_user
            }
        };

        tracing::info!("User found: {:?}", user);

        let token = self.generate_jwt(&user.id, &user.username)?;

        Ok(LoginResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            token,
        })
    }

    fn generate_jwt(&self, user_id: &uuid::Uuid, username: &str) -> AppResult<String> {
        let now = Utc::now();
        let claims = UserClaims {
            user_id: *user_id,
            username: username.to_string(),
            exp: (now + Duration::days(30)).timestamp(),
        };

        let token = self
            .jwt_service
            .encode(&claims, self.config.secret.as_ref())?;

        Ok(token)
    }
}
