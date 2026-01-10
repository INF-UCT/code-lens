use std::ops::Deref;

use axum::{
    Json,
    extract::{FromRequest, FromRequestParts, Path as AxumPath, Request},
    http::request::Parts,
};
use axum_responses::JsonResponse;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value, json};
use validator::{Validate, ValidationErrors};

pub struct Path<T>(pub T);

impl<S, T> FromRequestParts<S> for Path<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Send,
{
    type Rejection = JsonResponse;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let AxumPath(id) = AxumPath::<T>::from_request_parts(parts, &())
            .await
            .inspect_err(|e| tracing::error!("Path deserialization error: {e}"))
            .map_err(|_| JsonResponse::BadRequest())?;

        Ok(Path(id))
    }
}

impl<T> Deref for Path<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct Dto<T>(pub T);

impl<S, T> FromRequest<S> for Dto<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Validate,
{
    type Rejection = JsonResponse;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .inspect_err(|e| tracing::error!("Failed to extract JSON body: {e:?}"))
            .map_err(|_| JsonResponse::BadRequest().message("Invalid JSON Body"))?;

        value.validate().map_err(|err| {
            JsonResponse::BadRequest()
                .message("Schema validation error")
                .errors(format_validator_errors(err))
        })?;

        Ok(Dto(value))
    }
}

impl<T> Deref for Dto<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

fn format_validator_errors(e: ValidationErrors) -> Value {
    let mut formatted_errors = Map::new();

    for (field, field_errors) in e.field_errors() {
        let mut formatted_field_errors = vec![];

        for error in field_errors {
            formatted_field_errors.push(json!({
                "code": error.code,
                "message": error.message,
            }));
        }

        formatted_errors.insert(field.to_string(), Value::Array(formatted_field_errors));
    }

    Value::Object(formatted_errors)
}
