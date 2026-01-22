use std::sync::Arc;

use simple_ldap::{LdapClient, LdapConfig};
use sword::prelude::*;
use url::Url;

use crate::auth::ldap::{Ldap, LdapConfigData};
use crate::shared::AppResult;
use crate::users::UserRepository;

#[injectable]
pub struct AuthService {
    ldap_client: Arc<Ldap>,
    ldap_config: LdapConfigData,
    user_repo: Arc<UserRepository>,
}

impl AuthService {
    pub async fn authenticate(&self, username: &str, password: &str) -> AppResult<bool> {
        let user_dn = self.ldap_client.find_user_dn(username).await?;

        let user_dn = match user_dn {
            Some(dn) => dn,
            None => return Ok(false),
        };

        // Now, try to bind as the user
        let user_config = LdapConfig {
            bind_dn: user_dn.clone(),
            bind_password: password.to_string(),
            ldap_url: Url::parse(&self.ldap_config.url).expect("Failed to parse ldap url"),
            dn_attribute: None,
            connection_settings: None,
        };

        let authenticated = match LdapClient::new(user_config).await {
            Ok(_) => true,
            Err(_) => false,
        };

        if authenticated {
            // Check if user exists in DB
            let existing_user = self.user_repo.find_by_username(username).await?;

            if existing_user.is_none() {
                // Get user info from LDAP and create in DB
                let user_info = self
                    .ldap_client
                    .get_user_info(username)
                    .await
                    .map_err(|e| crate::shared::AppError::BadRequest(e.to_string()))?;

                if let Some(info) = user_info {
                    let create_user = crate::users::CreateUser {
                        username: username.to_string(),
                        dn: info.dn,
                        full_name: info.full_name,
                        email: info.email,
                    };
                    self.user_repo.create(create_user).await?;
                }
            }
        }

        Ok(authenticated)
    }
}
