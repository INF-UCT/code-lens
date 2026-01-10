use axum::http::{HeaderName, HeaderValue, Method};
use axum_config::config;
use serde::Deserialize;
use tower_http::cors::CorsLayer;

#[derive(Clone, Debug, Deserialize)]
#[config(key = "cors")]
pub struct CorsConfig {
    pub allowed_origins: Vec<String>,
    pub allowed_headers: Vec<String>,
    pub allowed_methods: Vec<String>,
    pub allow_credentials: bool,
}

pub fn setup_cors(config: CorsConfig) -> CorsLayer {
    let origins = config
        .allowed_origins
        .into_iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect::<Vec<HeaderValue>>();

    let methods = config
        .allowed_methods
        .into_iter()
        .filter_map(|m| m.parse::<Method>().ok())
        .collect::<Vec<Method>>();

    let headers = config
        .allowed_headers
        .into_iter()
        .filter_map(|h| h.parse::<HeaderName>().ok())
        .collect::<Vec<HeaderName>>();

    CorsLayer::new()
        .allow_credentials(config.allow_credentials)
        .allow_headers(headers)
        .allow_methods(methods)
        .allow_origin(origins)
}
