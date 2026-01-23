mod controller;
mod dtos;
mod services;

use controller::AuthController;
use services::LdapConfig;
use sword::prelude::*;

pub use dtos::LoginDto;
pub use services::{AuthService, LdapClient};

pub struct AuthModule;

impl Module for AuthModule {
    fn register_adapters(adapters: &AdapterRegistry) {
        adapters.register::<AuthController>();
    }

    fn register_components(components: &ComponentRegistry) {
        components.register::<AuthService>();
    }

    async fn register_providers(config: &Config, providers: &ProviderRegistry) {
        let ldap_config: LdapConfig = config.get_or_panic::<LdapConfig>();
        let ldap_client = LdapClient::new(ldap_config).await;

        providers.register(ldap_client);
    }
}
