use anyhow::{Context, Result};
use std::env;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub wiki_service_api_key: String,
    pub ollama_url: String,
    pub qdrant_url: String,
    pub wiki_output_dir: PathBuf,
    pub prompts_dir: PathBuf,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let wiki_service_api_key = get_required("WIKI_SERVICE_API_KEY")?;
        let ollama_url = get_required("OLLAMA_URL")?;
        let qdrant_url = get_required("QDRANT_URL")?;

        let wiki_output_dir = env::var("WIKI_OUTPUT_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/app/repos/wiki_output"));

        let prompts_dir = env::var("WIKI_PROMPTS_DIR")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/app/apps/wiki-rs/config"));

        Ok(Self {
            wiki_service_api_key,
            ollama_url,
            qdrant_url,
            wiki_output_dir,
            prompts_dir,
        })
    }
}

fn get_required(key: &str) -> Result<String> {
    env::var(key).with_context(|| format!("{key} env var is required"))
}
