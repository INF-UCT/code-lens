use serde::Deserialize;
use simple_ldap::{LdapClient, LdapConfig, filter::EqFilter};
use std::sync::Arc;
use sword::prelude::*;
use tokio::sync::Mutex;
use url::Url;

use crate::auth::ldap::{UserEntry, UserInfo, UserInfoEntry};
use crate::shared::AppResult;

#[derive(Clone, Deserialize)]
#[config(key = "ldap")]
pub struct LdapConfigData {
    pub url: String,
    pub bind_dn: String,
    pub bind_password: String,
    pub base_dn: String,
    pub user_attribute: String,
}

#[injectable(provider)]
pub struct Ldap {
    client: Arc<Mutex<LdapClient>>,
    config: LdapConfigData,
}

impl Ldap {
    pub async fn new(ldap_config: LdapConfigData) -> Self {
        let config = LdapConfig {
            bind_dn: ldap_config.bind_dn.clone(),
            bind_password: ldap_config.bind_password.clone(),
            ldap_url: Url::parse(&ldap_config.url).expect("Failed to parse ldap url"),
            dn_attribute: None,
            connection_settings: None,
        };

        let client = LdapClient::new(config)
            .await
            .expect("Failed to create LDAP client");

        Self {
            client: Arc::new(Mutex::new(client)),
            config: ldap_config,
        }
    }

    pub async fn find_user_dn(&self, username: &str) -> AppResult<Option<String>> {
        let filter = EqFilter::from(self.config.user_attribute.clone(), username.to_string());
        let mut client = self.client.lock().await;
        let search_result: Vec<UserEntry> = client
            .search(
                &self.config.base_dn,
                simple_ldap::ldap3::Scope::Subtree,
                &filter,
                vec!["dn"],
            )
            .await?;

        if search_result.is_empty() {
            Ok(None)
        } else {
            Ok(Some(search_result[0].dn.to_string()))
        }
    }
    pub async fn get_user_info(&self, username: &str) -> AppResult<Option<UserInfo>> {
        let filter = EqFilter::from(self.config.user_attribute.clone(), username.to_string());
        let mut client = self.client.lock().await;
        let search_result: Vec<UserInfoEntry> = client
            .search(
                &self.config.base_dn,
                simple_ldap::ldap3::Scope::Subtree,
                &filter,
                vec!["dn", "cn", "mail"],
            )
            .await
            .map_err(|e| crate::shared::AppError::BadRequest(e.to_string()))?;

        if search_result.is_empty() {
            Ok(None)
        } else {
            let entry = &search_result[0];
            Ok(Some(UserInfo {
                dn: entry.dn.to_string(),
                full_name: entry.cn.clone(),
                email: entry.mail.clone(),
            }))
        }
    }
}
