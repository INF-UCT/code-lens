mod agents;
mod api;
mod config;
mod docs;
mod error;
mod llm;
mod models;
mod prompts;
mod rag;

use anyhow::Result;
use api::build_router;
use config::AppConfig;
use std::sync::Arc;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    let config = Arc::new(AppConfig::from_env()?);
    let state = api::AppState::new(config).await?;

    let app = build_router(state).layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind(("0.0.0.0", 3000)).await?;
    info!("wiki-rs listening on 0.0.0.0:3000");

    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));

    tracing_subscriber::fmt().with_env_filter(filter).init();
}
