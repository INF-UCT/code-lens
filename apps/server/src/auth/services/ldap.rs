use crate::shared::AppResult;

use ldap3::{LdapConnAsync, LdapConnSettings};
use serde::Deserialize;
use std::time::Duration;
use sword::prelude::*;

#[derive(Clone, Deserialize)]
#[config(key = "ldap")]
pub struct LdapConfig {
    pub url: String,
    pub base_dn: String,
}

#[injectable]
pub struct LdapClient {
    config: LdapConfig,
}

impl LdapClient {
    pub async fn authenticate(&self, username: &str, password: &str) -> AppResult<()> {
        let dn = format!("uid={},{}", username, self.config.base_dn);

        let settings = LdapConnSettings::new()
            .set_conn_timeout(Duration::from_secs(5))
            .set_no_tls_verify(true);

        let (conn, mut ldap) = LdapConnAsync::with_settings(settings, &self.config.url)
            .await
            .inspect_err(|e| {
                tracing::error!("[!] error de conexión LDAP a {}: {e}", &self.config.url);
            })?;

        ldap3::drive!(conn);

        ldap.simple_bind(&dn, password)
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

        ldap.unbind().await.map_err(|e| {
            tracing::error!("[!] error al desautenticar: {e}");
            e
        })?;

        Ok(())
    }
}
