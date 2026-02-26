use crate::tokens::TokensService;
use std::sync::Arc;
use sword::prelude::*;

#[derive(Interceptor)]
pub struct UserTokenCheck {
    tokens_service: Arc<TokensService>,
}

impl OnRequest for UserTokenCheck {
    async fn on_request(&self, mut req: Request) -> HttpInterceptorResult {
        let auth_header = req.authorization().ok_or_else(JsonResponse::Unauthorized)?;

        if !auth_header.starts_with("Bearer ") {
            return Err(JsonResponse::Unauthorized());
        }

        let parts = auth_header.split("Bearer ").collect::<Vec<_>>();

        if parts.len() != 2 {
            return Err(JsonResponse::Unauthorized());
        }

        let token = parts[1].to_string();

        if self.tokens_service.is_token_revoked(&token).await? {
            return Err(JsonResponse::Unauthorized());
        }

        let claims = self.tokens_service.decode_user_token(&token)?;

        req.extensions.insert(claims);

        req.next().await
    }
}
