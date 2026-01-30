mod controller;
mod dtos;
mod interceptor;
mod service;

use controller::RepositoriesController;
use sword::prelude::*;
use thiserror::Error;

pub use dtos::*;
pub use interceptor::RepositoryTokenCheck;
pub use service::*;

#[derive(Error, Debug)]
pub enum RepositoryError {
    #[error("Git clone failed: {0}")]
    CloneError(#[from] git2::Error),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Sanitization error: {0}")]
    SanitizationError(String),
}

pub struct RepositoriesModule;

impl Module for RepositoriesModule {
    fn register_adapters(adapters: &AdapterRegistry) {
        adapters.register::<RepositoriesController>();
    }
}
