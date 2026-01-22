mod controller;
mod dtos;

use controller::RepositoriesController;
use sword::prelude::*;

pub use dtos::*;

pub struct RepositoriesModule;

impl Module for RepositoriesModule {
    fn register_adapters(adapters: &AdapterRegistry) {
        adapters.register::<RepositoriesController>();
    }
}
