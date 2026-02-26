use crate::tokens::{GenerateTokenDto, TokensRepository, TokensService, UserClaims, UserTokenCheck};
use std::sync::Arc;
use sword::prelude::*;
use uuid::Uuid;

#[controller("/tokens")]
#[interceptor(UserTokenCheck)]
pub struct TokensController {
    tokens_service: Arc<TokensService>,
    tokens_repository: Arc<TokensRepository>,
}

impl TokensController {
    #[get("/{user_id}")]
    pub async fn list_tokens(&self, req: Request) -> HttpResult<JsonResponse> {
        let claims = req.extensions.get::<UserClaims>().unwrap();
        let requested_user_id = req.param::<Uuid>("user_id")?;

        if claims.user_id != requested_user_id {
            return Err(JsonResponse::Forbidden());
        }

        let tokens = self.tokens_repository.find_by_user_id(&requested_user_id).await?;

        Ok(JsonResponse::Ok().data(tokens))
    }

    #[post("/generate")]
    pub async fn generate_token(&self, req: Request) -> HttpResult<JsonResponse> {
        let claims = req.extensions.get::<UserClaims>().unwrap();
        let dto = req.body_validator::<GenerateTokenDto>()?;

        if claims.user_id != dto.user_id {
            return Err(JsonResponse::Forbidden());
        }

        let token = self.tokens_service.generate(&dto)?;

        self.tokens_repository.save(&token).await?;

        Ok(JsonResponse::Ok().data(token.value))
    }

    #[post("/logout")]
    pub async fn logout(&self, req: Request) -> HttpResult<JsonResponse> {
        let auth_header = req.authorization().unwrap();
        let token = auth_header.strip_prefix("Bearer ").unwrap();

        self.tokens_service.revoke_token(&token.to_string()).await?;

        Ok(JsonResponse::Ok().data("Logged out successfully"))
    }
}
