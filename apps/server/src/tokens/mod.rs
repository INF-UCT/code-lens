mod controller;
mod dtos;
mod repository;
mod service;

use controller::TokensController;
use repository::TokensRepository;
use service::TokensService;
use sword::prelude::*;

pub use dtos::{RegisterTokenDto, Token, TokenClaims};

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
