use crate::auth::{AuthService, LoginDto};
use std::sync::Arc;
use sword::prelude::*;

#[controller("/auth")]
pub struct AuthController {
    auth_service: Arc<AuthService>,
}

impl AuthController {
    #[post("/login")]
    pub async fn login(&self, req: Request) -> HttpResult<JsonResponse> {
        let dto = req.body::<LoginDto>()?;
        let user = self.auth_service.login(dto).await?;

        Ok(JsonResponse::Ok().data(user))
    }
}
