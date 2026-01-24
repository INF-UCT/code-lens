mod controller;
mod dtos;
mod services;

use controller::AuthController;
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
        components.register::<LdapClient>();
    }
}
