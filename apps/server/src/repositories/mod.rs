mod controllers;
mod dtos;

use crate::AppState;
use axum::{
    routing::Router,
    routing::{get, post},
};

pub use controllers::*;
pub use dtos::*;

pub fn router(state: AppState) -> Router<AppState> {
    let routes = Router::new()
        .route("/", get(get_repository))
        .route("/", post(analize_repository));

    Router::new()
        .nest("/repositories", routes)
        .with_state(state)
}
