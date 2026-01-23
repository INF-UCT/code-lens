use ldap3::LdapError;
use sword::prelude::*;
use thiserror::Error;

use jsonwebtoken::errors::Error as JwtError;
use sqlx::Error as SqlxError;

pub type AppResult<T = JsonResponse> = Result<T, AppError>;

#[derive(Debug, Error, HttpError)]
pub enum AppError {
    #[http(code = 403)]
    #[error("Unauthorized: {0}")]
    Unauthorized(#[from] JwtError),

    #[http(code = 500)]
    #[error("Database error: {0}")]
    Database(#[from] SqlxError),

    #[http(code = 400)]
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[http(code = 401)]
    #[error("LDAP Authentication failed: {0}")]
    LdapAuth(#[from] LdapError),
}
