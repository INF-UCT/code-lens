use crate::shared::{AppResult, errors::AppError};

use ldap3::{LdapConnAsync, LdapConnSettings, Scope, SearchEntry};
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
    pub async fn authenticate(&self, username: &str, password: &str) -> AppResult<String> {
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

        let email = self.find_email(&mut ldap, username).await?;

        ldap.unbind().await.inspect_err(|e| {
            tracing::error!("[!] error al desautenticar: {e}");
        })?;

        Ok(email)
    }

    async fn find_email(&self, conn: &mut ldap3::Ldap, username: &str) -> AppResult<String> {
        let filter = format!("(uid={username})");

        let (results, _) = conn
            .search(&self.config.base_dn, Scope::Subtree, &filter, vec!["mail"])
            .await?
            .success()?;

        let email = results
            .into_iter()
            .next()
            .and_then(|entry| {
                let entry = SearchEntry::construct(entry);
                entry.attrs.get("mail").and_then(|m| m.first().cloned())
            })
            .ok_or_else(|| {
                tracing::error!(
                    "[!] no se encontró correo electrónico para el usuario: {username}"
                );

                AppError::LdapEmailNotFound
            })?;

        Ok(email)
    }
}
