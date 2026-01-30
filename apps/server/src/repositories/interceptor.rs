use crate::tokens::{TokenClaims, TokensService};
use std::sync::Arc;
use sword::prelude::*;

#[derive(Interceptor)]
pub struct RepositoryTokenCheck {
    tokens_service: Arc<TokensService>,
}

impl OnRequest for RepositoryTokenCheck {
    async fn on_request(&self, mut req: Request) -> HttpInterceptorResult {
        let token = req.authorization().ok_or(JsonResponse::Unauthorized())?;
        let claims = self.tokens_service.decode(&token.to_owned())?;

        req.extensions.insert::<TokenClaims>(claims);

        req.next().await
    }
}
