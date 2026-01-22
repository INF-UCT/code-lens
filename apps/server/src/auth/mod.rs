mod controller;
mod ldap;
mod service;

use controller::AuthController;
use ldap::{Ldap, LdapConfigData};
use service::AuthService;
use sword::prelude::*;

pub struct AuthModule;

impl Module for AuthModule {
    fn register_adapters(adapters: &AdapterRegistry) {
        adapters.register::<AuthController>();
    }

    fn register_components(components: &ComponentRegistry) {
        components.register::<AuthService>();
    }

    async fn register_providers(config: &Config, providers: &ProviderRegistry) {
        let ldap_config = config.get_or_panic::<LdapConfigData>();
        let ldap = Ldap::new(ldap_config).await;

        providers.register(ldap);
    }
}
