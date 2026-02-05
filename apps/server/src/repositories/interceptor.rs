use crate::tokens::{TokenClaims, TokensService};
use std::sync::Arc;
use sword::prelude::*;

#[derive(Interceptor)]
pub struct RepositoryTokenCheck {
    tokens_service: Arc<TokensService>,
}

impl OnRequest for RepositoryTokenCheck {
    async fn on_request(&self, mut req: Request) -> HttpInterceptorResult {
        let auth_header = req.authorization().ok_or_else(JsonResponse::Unauthorized)?;

        if !auth_header.starts_with("Bearer ") {
            return Err(JsonResponse::Unauthorized());
        }

        let parts = auth_header.split("Bearer ").collect::<Vec<_>>();

        if parts.len() != 2 {
            return Err(JsonResponse::Unauthorized());
        }

        let claims = self.tokens_service.decode(&parts[1].to_string())?;

        req.extensions.insert::<TokenClaims>(claims);

        req.next().await
    }
}
