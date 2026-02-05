use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Repository {
    pub name: String,
    pub url: String,
    pub branch: String,
    pub commit_sha: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub type AnalyzeRepositoryData = (Uuid, PathBuf, String);

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct AnalyzeRepositoryDto {
    #[validate(length(min = 1, max = 255))]
    pub name: String, // $GITHUB_REPOSITORY

    #[validate(url)]
    pub url: String, // github.event.repository.html_url

    #[validate(custom(function = "validate_branch"))]
    pub branch: String, // For push events

    #[serde(default)]
    pub commit_sha: String, // For push events
}

fn validate_branch(branch: &str) -> Result<(), ValidationError> {
    if branch != "main" && branch != "master" {
        return Err(ValidationError {
            code: "branch".into(),
            message: Some("Branch must be 'main' or 'master'".into()),
            params: HashMap::new(),
        });
    }

    Ok(())
}

impl From<AnalyzeRepositoryDto> for Repository {
    fn from(input: AnalyzeRepositoryDto) -> Self {
        Repository {
            url: input.url,
            name: input.name,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            branch: input.branch,
            commit_sha: input.commit_sha,
        }
    }
}
