use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use uuid::Uuid;
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub owner: String,
    pub url: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct RepositoryInput {
    #[validate(url)]
    pub url: String, // github.event.repository.html_url

    #[validate(length(min = 1, max = 255))]
    pub name: String, // $GITHUB_REPOSITORY

    #[validate(length(min = 1, max = 255))]
    pub owner: String, // $GITHUB_REPOSITORY_OWNER

    #[validate(custom(function = validate_target_branch))]
    pub pr_target_branch: String, // github.event.pull_request.base.ref

    #[validate(length(min = 1, max = 255))]
    pub pr_from_branch: String, // github.event.pull_request.head.ref
}

fn validate_target_branch(branch: &str) -> Result<(), ValidationError> {
    if branch != "main" && branch != "master" {
        return Err(ValidationError {
            code: "pr_target_branch".into(),
            message: Some("Target branch must be 'main' or 'master'".into()),
            params: HashMap::new(),
        });
    }

    Ok(())
}

impl From<RepositoryInput> for Repository {
    fn from(input: RepositoryInput) -> Self {
        Repository {
            id: Uuid::new_v4(),
            url: input.url,
            name: input.name,
            owner: input.owner,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}
