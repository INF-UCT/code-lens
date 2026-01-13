mod controllers;
mod dtos;

use crate::common::AppState;
use axum::{Router, routing::post};

pub use dtos::*;

pub fn token_router() -> Router<AppState> {
    Router::new()
        .route("/token/register", post(controllers::register_token))
        .route("/token/refresh/{token}", post(controllers::refresh_token))
}
