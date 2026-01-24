use crate::tokens::{GenerateTokenDto, TokensRepository, TokensService};
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[controller("/tokens")]
pub struct TokensController {
    tokens_service: Arc<TokensService>,
    tokens_repository: Arc<TokensRepository>,
}

impl TokensController {
    #[get("/{user_id}")]
    pub async fn list_tokens(&self, req: Request) -> HttpResult<JsonResponse> {
        let user_id = req.param::<Uuid>("user_id")?;
        let tokens = self.tokens_repository.find_by_user_id(&user_id).await?;

        Ok(JsonResponse::Ok().data(tokens))
    }

    #[post("/generate")]
    pub async fn generate_token(&self, req: Request) -> HttpResult<JsonResponse> {
        let dto = req.body_validator::<GenerateTokenDto>()?;
        let token = self.tokens_service.generate(&dto).await?;

        self.tokens_repository.save(&token).await?;

        Ok(JsonResponse::Ok().data(token.value))
    }
}
