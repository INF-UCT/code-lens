use crate::{
    common::{
        AppError, AppState, Dto, JwtConfig,
        jsonwebtoken::{generate_token, refresh_token as refresh_jwt_token},
    },
    token::{RegisterTokenDto, Token},
};
use axum::Extension;
use axum::extract::{Path, State};
use axum_config::Config;
use axum_responses::JsonResponse;
use chrono::Utc;

pub async fn register_token(
    State(state): State<AppState>,
    Extension(config): Extension<Config>,
    Dto(input): Dto<RegisterTokenDto>,
) -> Result<JsonResponse, AppError> {
    let jwt_config = config.get_or_panic::<JwtConfig>();
    let jwt_secret = &jwt_config.secret;
    let repo_url = &input.repository_url;
    let exp_months = input.expiration_months as i64;

    let (id, token_str) = generate_token(repo_url, exp_months, jwt_secret).await?;

    let now = Utc::now();

    let token = Token {
        id,
        token: token_str.clone(),
        repository_url: repo_url.clone(),
        refresh_count: 0,
        created_at: now,
    };

    sqlx::query(
        "INSERT INTO tokens (id, token, repository_url, refresh_count, created_at) 
        VALUES ($1, $2, $3, $4, $5)",
    )
    .bind(token.id)
    .bind(&token.token)
    .bind(&token.repository_url)
    .bind(token.refresh_count)
    .bind(token.created_at)
    .execute(&*state.database.get_pool())
    .await?;

    Ok(JsonResponse::Ok().data(token_str))
}

pub async fn refresh_token(
    State(state): State<AppState>,
    Extension(config): Extension<Config>,
    Path(token): Path<String>,
) -> Result<JsonResponse, AppError> {
    let jwt_config = config.get_or_panic::<JwtConfig>();
    let (id, token_str) = refresh_jwt_token(&token, &jwt_config.secret).await?;

    sqlx::query(
        "UPDATE tokens SET token = $1, refresh_count = refresh_count + 1 
        WHERE id = $2",
    )
    .bind(&token_str)
    .bind(id)
    .execute(&*state.database.get_pool())
    .await?;

    Ok(JsonResponse::Ok().data(token_str))
}
