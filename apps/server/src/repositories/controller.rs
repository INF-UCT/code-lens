use super::{AnalyzeRepositoryDto, RepositoriesService, RepositoryTokenCheck};
use crate::{
    shared::EventQueue,
    tokens::{TokenClaims, TokensRepository},
    users::UserRepository,
};
use std::sync::Arc;
use sword::prelude::*;

#[controller("/repositories")]
pub struct RepositoriesController {
    event_queue: Arc<EventQueue>,
    service: Arc<RepositoriesService>,
    tokens_repository: Arc<TokensRepository>,
    users: Arc<UserRepository>,
}

impl RepositoriesController {
    #[get("/")]
    pub async fn get_all_repositories(&self) -> HttpResult<JsonResponse> {
        Ok(JsonResponse::Ok().data(self.service.find_all().await?))
    }

    #[get("/{id}")]
    pub async fn get_repository(&self, _: Request) -> HttpResult<JsonResponse> {
        Ok(JsonResponse::Ok())
    }

    #[post("/")]
    #[interceptor(RepositoryTokenCheck)]
    pub async fn analyze_repository(&self, req: Request) -> HttpResult<JsonResponse> {
        let dto = req.body_validator::<AnalyzeRepositoryDto>()?;
        let token_claims = req
            .extensions
            .get::<TokenClaims>()
            .ok_or_else(JsonResponse::Unauthorized)?;

        let Some(token) = self.tokens_repository.find_by_id(&token_claims.id).await? else {
            return Err(JsonResponse::Unauthorized());
        };

        let Some(owner_data) = self.users.find_by_id(&token.user_id).await? else {
            return Err(JsonResponse::BadRequest().message("Repository owner not found"));
        };

        let repository_id = self.service.generate_docs(&dto, owner_data).await?;

        Ok(JsonResponse::Ok().data(repository_id))
    }
}
