use super::{AnalyzeRepositoryDto, RepositoriesService, Repository, RepositoryTokenCheck};
use std::sync::Arc;
use sword::prelude::*;

#[controller("/repositories")]
pub struct RepositoriesController {
    service: Arc<RepositoriesService>,
}

impl RepositoriesController {
    #[get("/{id}")]
    pub async fn get_repository(&self, _: Request) -> HttpResult<JsonResponse> {
        Ok(JsonResponse::Ok())
    }

    #[post("/")]
    #[interceptor(RepositoryTokenCheck)]
    pub async fn analyze_repository(&self, req: Request) -> HttpResult<JsonResponse> {
        let body = req.body_validator::<AnalyzeRepositoryDto>()?;
        let repository = Repository::from(body);

        self.service
            .git_clone(&repository.url, &repository.branch)
            .await?;

        Ok(JsonResponse::Ok().data(repository))
    }
}
