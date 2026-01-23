use crate::shared::AppResult;

use ldap3::{Ldap, LdapConnAsync, LdapConnSettings};
use serde::Deserialize;
use std::{sync::Arc, time::Duration};
use sword::prelude::*;
use tokio::sync::RwLock;

#[derive(Clone, Deserialize)]
#[config(key = "ldap")]
pub struct LdapConfig {
    pub url: String,
    pub base_dn: String,
}

#[injectable(provider)]
pub struct LdapClient {
    client: Arc<RwLock<Ldap>>,
    config: LdapConfig,
}

impl LdapClient {
    pub async fn new(config: LdapConfig) -> Self {
        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(5))
            .set_no_tls_verify(true);

        let (conn, ldap) = LdapConnAsync::with_settings(settings, &config.url)
            .await
            .unwrap_or_else(|e| {
                panic!("[!] error de conexión LDAP: {e}");
            });

        ldap3::drive!(conn);

        LdapClient {
            client: Arc::new(RwLock::new(ldap)),
            config: config,
        }
    }

    pub async fn authenticate(&self, username: &str, password: &str) -> AppResult<()> {
        let dn = format!("uid={},{}", username, self.config.base_dn);

        self.client
            .write()
            .await
            .simple_bind(&dn, password)
            .await
            .inspect_err(|e| {
                tracing::error!("[!] error de autenticación with dn: {dn}");
                tracing::error!("[!] error: {e}");
            })?
            .success()
            .inspect_err(|e| {
                tracing::error!("[!] error de autenticación with dn: {dn}");
                tracing::error!("[!] error: {e}");
            })?;

        Ok(())
    }
}
