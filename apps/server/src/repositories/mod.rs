mod controllers;
mod dtos;

use crate::AppState;
use axum::{
    routing::Router,
    routing::{get, post},
};

pub use dtos::*;

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/repositories/", get(controllers::get_repository))
        .route("/repositories/", post(controllers::analyze_repository))
        .with_state(state)
}
