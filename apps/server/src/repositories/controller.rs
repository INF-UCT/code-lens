use super::{AnalyzeRepositoryDto, RepositoriesService, Repository, RepositoryTokenCheck};
use crate::shared::EventQueue;
use std::sync::Arc;
use sword::prelude::*;

#[controller("/repositories")]
pub struct RepositoriesController {
    service: Arc<RepositoriesService>,
    event_queue: Arc<EventQueue>,
}

impl RepositoriesController {
    #[get("/{id}")]
    pub async fn get_repository(&self, _: Request) -> HttpResult<JsonResponse> {
        Ok(JsonResponse::Ok())
    }

    #[post("/")]
    #[interceptor(RepositoryTokenCheck)]
    pub async fn analyze_repository(&self, req: Request) -> HttpResult<JsonResponse> {
        let dto = req.body_validator::<AnalyzeRepositoryDto>()?;
        let repository = Repository::from(dto);

        Ok(JsonResponse::Ok().data(repository))
    }
}
