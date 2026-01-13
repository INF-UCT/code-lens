mod common;
mod repositories;
mod token;

use axum::{Extension, extract::DefaultBodyLimit, http::StatusCode, routing::Router};
use axum_config::Config;
use common::{AppState, CorsConfig, Database, DatabaseConfig, ServerConfig, setup_cors};
use repositories::router as repositories_router;
use std::{sync::Arc, time::Duration};
use tokio::net::TcpListener;
use tower_http::timeout::TimeoutLayer;

use crate::token::token_router;

#[tokio::main]
async fn main() {
    let config = Config::from_path("/app/.config/server.toml").expect("Failed to load config");

    let db_config = config.get_or_panic::<DatabaseConfig>();
    let server_config = config.get_or_panic::<ServerConfig>();
    let cors_config = config.get_or_panic::<CorsConfig>();

    let db = Database::new(db_config).await;

    let state = AppState {
        database: Arc::new(db),
    };

    let token_router = token_router();
    let repositories_router = repositories_router(state.clone());

    let listener = TcpListener::bind(&format!("{}:{}", server_config.host, server_config.port))
        .await
        .expect("Failed to bind to address");

    let app = Router::new()
        .merge(token_router)
        .merge(repositories_router)
        .layer(Extension(config))
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(server_config.request_timeout_secs),
        ))
        .layer(DefaultBodyLimit::max(server_config.body_limit))
        .layer(setup_cors(cors_config))
        .with_state(state);

    println!(
        "Server running on {}:{}",
        server_config.host, server_config.port
    );

    axum::serve(listener, app)
        .await
        .expect("Failed to serve application")
}
