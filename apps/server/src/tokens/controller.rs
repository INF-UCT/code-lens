use crate::tokens::{RegisterTokenDto, TokensRepository, TokensService};
use std::sync::Arc;
use sword::prelude::*;

#[controller("/tokens")]
pub struct TokensController {
    tokens_service: Arc<TokensService>,
    tokens_repository: Arc<TokensRepository>,
}

impl TokensController {
    #[post("/register")]
    pub async fn register_token(&self, req: Request) -> HttpResult<JsonResponse> {
        let dto = req.body_validator::<RegisterTokenDto>()?;
        let token = self.tokens_service.generate(&dto)?;

        self.tokens_repository.save(&token).await?;

        Ok(JsonResponse::Ok().data(token.value))
    }

    #[post("/refresh/{token}")]
    pub async fn refresh_token(&self, req: Request) -> HttpResult<JsonResponse> {
        let token = req.param::<String>("token")?;
        let new_token = self.tokens_service.refresh(&token)?;

        self.tokens_repository.save(&new_token).await?;

        Ok(JsonResponse::Ok().data(new_token.value))
    }
}
