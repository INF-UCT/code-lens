use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;
use std::collections::HashMap;
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Repository {
    pub name: String,
    pub owner: String,
    pub url: String,
    pub branch: String,
    pub commit_sha: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Repository {
    pub fn _pk(&self) -> (String, String) {
        (self.name.clone(), self.owner.clone())
    }
}

#[derive(Clone, Debug, Deserialize, Validate)]
pub struct AnalyzeRepositoryDto {
    #[validate(url)]
    pub url: String, // github.event.repository.html_url

    #[validate(length(min = 1, max = 255))]
    pub name: String, // $GITHUB_REPOSITORY

    #[validate(length(min = 1, max = 255))]
    pub owner: String, // $GITHUB_REPOSITORY_OWNER

    #[serde(default)]
    pub branch: String, // For push events

    #[serde(default)]
    pub commit_sha: Option<String>, // For push events

    #[serde(default)]
    #[validate(custom(function = "validate_target_branch"))]
    pub pr_target_branch: Option<String>, // github.event.pull_request.base.ref
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

impl From<AnalyzeRepositoryDto> for Repository {
    fn from(input: AnalyzeRepositoryDto) -> Self {
        Repository {
            url: input.url,
            name: input.name,
            owner: input.owner,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            branch: input.branch,
            commit_sha: input.commit_sha,
        }
    }
}
