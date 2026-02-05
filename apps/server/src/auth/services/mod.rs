mod ldap;

use crate::{
    auth::LoginDto,
    shared::AppResult,
    users::{User, UserRepository},
};

use std::sync::Arc;
use sword::prelude::*;

pub use ldap::LdapClient;

#[injectable]
pub struct AuthService {
    ldap: Arc<LdapClient>,
    users: Arc<UserRepository>,
}

impl AuthService {
    pub async fn login(&self, input: LoginDto) -> AppResult<User> {
        self.ldap
            .authenticate(&input.username, &input.password)
            .await?;

        let user_exists = self.users.find_by_username(&input.username).await?;

        tracing::info!("User exists: {:?}", user_exists.is_some());

        let Some(user) = user_exists else {
            let new_user = User::new(input.username.to_owned());
            self.users.create(&new_user).await?;

            tracing::info!("Created new user: {:?}", new_user);

            return Ok(new_user);
        };

        tracing::info!("User found: {:?}", user);

        Ok(user)
    }
}
