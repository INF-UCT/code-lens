use crate::AppState;
use crate::common::{Dto, HttpResult, Path};
use crate::repositories::{Repository, RepositoryInput};

use axum::extract::State;
use axum_responses::JsonResponse;
use uuid::Uuid;

pub async fn get_repository(id: Path<Uuid>) -> HttpResult<JsonResponse> {
    Ok(JsonResponse::Ok().data(*id))
}

pub async fn analize_repository(
    State(state): State<AppState>,
    Dto(input): Dto<RepositoryInput>,
) -> HttpResult<JsonResponse> {
    let repository = Repository::from(input);

    println!("Hi db pool {:?}", state.database.get_pool());

    Ok(JsonResponse::Ok().data(repository))
}
