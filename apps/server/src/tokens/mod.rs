mod controller;
mod dtos;
mod repository;
mod service;

use controller::TokensController;
use sword::prelude::*;

pub use dtos::{GenerateTokenDto, Token, TokenClaims};
pub use repository::TokensRepository;
pub use service::TokensService;

pub struct TokensModule;

impl Module for TokensModule {
    fn register_adapters(adapters: &AdapterRegistry) {
        adapters.register::<TokensController>();
    }

    fn register_components(components: &ComponentRegistry) {
        components.register::<TokensService>();
        components.register::<TokensRepository>();
    }
}
