mod cors;
mod database;
mod errors;
mod extractors;
pub mod jsonwebtoken;

use axum_config::config;
use axum_responses::JsonResponse;
use serde::Deserialize;
use std::sync::Arc;

pub use cors::{CorsConfig, setup_cors};
pub use database::*;
pub use errors::*;
pub use extractors::*;
pub use jsonwebtoken::JwtConfig;

pub type HttpResult<T = JsonResponse> = Result<T, JsonResponse>;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "server")]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
    pub body_limit: usize,
    pub request_timeout_secs: u64,
}

#[derive(Clone)]
pub struct AppState {
    pub database: Arc<Database>,
}
