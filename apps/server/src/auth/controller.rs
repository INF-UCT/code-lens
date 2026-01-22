use serde::Deserialize;
use std::sync::Arc;
use sword::prelude::*;

use crate::auth::service::AuthService;
use crate::shared::AppError;

#[derive(Deserialize)]
pub struct LoginRequest {
    username: String,
    password: String,
}

#[controller("/auth")]
pub struct AuthController {
    auth_service: Arc<AuthService>,
}

impl AuthController {
    #[post("/login")]
    pub async fn login(&self, req: Request) -> HttpResult<JsonResponse> {
        let body: LoginRequest = req.body()?;

        let authenticated = self
            .auth_service
            .authenticate(&body.username, &body.password)
            .await?;

        if authenticated {
            Ok(JsonResponse::Ok())
        } else {
            Err(AppError::BadRequest("Invalid credentials".to_string()).into())
        }
    }
}
