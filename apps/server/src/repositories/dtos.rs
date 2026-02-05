use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use std::{collections::HashMap, path::PathBuf};
use uuid::Uuid;
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Repository {
    pub id: Uuid,
    pub name: String,
    pub url: String,
    pub owner_id: Uuid,
    pub default_branch: String,
    pub last_commit_sha: String,
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

impl From<(&Uuid, &AnalyzeRepositoryDto)> for Repository {
    fn from((owner_id, data): (&Uuid, &AnalyzeRepositoryDto)) -> Self {
        let now = Utc::now();

        Self {
            id: Uuid::new_v4(),
            default_branch: data.branch.clone(),
            last_commit_sha: data.commit_sha.clone(),
            name: data.name.clone(),
            url: data.url.clone(),
            owner_id: *owner_id,
            created_at: now,
            updated_at: now,
        }
    }
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
