use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct DocGenerationInput {
    #[serde(rename = "repoId")]
    pub repo_id: Uuid,
    #[serde(rename = "repoPath")]
    pub repo_path: String,
    #[serde(rename = "repoTree")]
    pub repo_tree: String,
}

#[derive(Debug, Serialize)]
pub struct DocGenerationResponse {
    pub repo_id: Uuid,
    pub message: String,
    pub generated_pages: usize,
    pub output_path: String,
    pub errors: Vec<PageGenerationError>,
}

#[derive(Debug, Serialize)]
pub struct PageGenerationError {
    pub page_id: String,
    pub page_title: String,
    pub error: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub struct WikiStructure {
    pub title: String,
    pub description: String,
    pub sections: Vec<WikiSection>,
    pub pages: Vec<WikiPage>,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub struct WikiSection {
    pub id: String,
    pub title: String,
    pub pages: Vec<String>,
    pub subsections: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
pub struct WikiPage {
    pub id: String,
    pub title: String,
    pub description: String,
    pub importance: Importance,
    pub relevant_files: Vec<String>,
    pub related_pages: Vec<String>,
    pub parent_section: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "lowercase")]
pub enum Importance {
    High,
    Medium,
    Low,
}

#[derive(Clone, Debug)]
pub struct RetrievedChunk {
    pub content: String,
    pub source: String,
    pub kind: String,
    pub language: String,
    pub chunk_index: usize,
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
    pub score: f32,
}

#[derive(Clone, Debug)]
pub struct PreparedDoc {
    pub id: String,
    pub text: String,
    pub metadata: HashMap<String, serde_json::Value>,
    pub embedding: Vec<f32>,
}
