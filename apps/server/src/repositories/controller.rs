use super::{Repository, RepositoryInput};
use sword::prelude::*;

#[controller("/repositories")]
pub struct RepositoriesController;

impl RepositoriesController {
    #[get("/{id}")]
    pub async fn get_repository(&self, _: Request) -> HttpResult<JsonResponse> {
        Ok(JsonResponse::Ok())
    }

    #[post("/")]
    pub async fn analyze_repository(&self, req: Request) -> HttpResult<JsonResponse> {
        let body = req.body_validator::<RepositoryInput>()?;
        let repository = Repository::from(body);

        dbg!(&repository);

        Ok(JsonResponse::Ok().data(repository))
    }
}
