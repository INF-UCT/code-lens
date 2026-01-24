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

    #[http(
        code = 401,
        message = "The requested token was not found. Try again or generate a new one."
    )]
    #[error("Unauthorized access")]
    TokenNotFound,

    #[http(
        code = 401,
        message = "The provided token is invalid. Please try again or generate a new one."
    )]
    #[error("Invalid token")]
    InvalidToken,

    #[http(code = 500)]
    #[error("Database error: {0}")]
    Database(#[from] SqlxError),

    #[http(code = 400)]
    #[error("Bad request: {0}")]
    BadRequest(String),

    #[http(
        code = 401,
        message = "Invalid Credentials. Please try again, or contact support."
    )]
    #[error("LDAP Authentication failed: {0}")]
    LdapAuth(#[from] LdapError),
}
