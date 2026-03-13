use anyhow::{Context, Result};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use walkdir::WalkDir;

#[derive(Clone)]
pub struct PromptStore {
    prompts: HashMap<String, String>,
}

impl PromptStore {
    pub async fn load(base_path: &Path) -> Result<Self> {
        let mut prompts = HashMap::new();

        for entry in WalkDir::new(base_path) {
            let entry = entry?;
            let path = entry.path();

            if !entry.file_type().is_file() {
                continue;
            }

            if path.extension().and_then(|v| v.to_str()) != Some("txt") {
                continue;
            }

            let key = generate_key(base_path, path)?;
            let content = fs::read_to_string(path)
                .await
                .with_context(|| format!("failed to read prompt file {}", path.display()))?;

            prompts.insert(key, content);
        }

        Ok(Self { prompts })
    }

    pub fn render(&self, key: &str, vars: &[(&str, String)]) -> Result<String> {
        let template = self
            .prompts
            .get(key)
            .with_context(|| format!("Prompt not found: {key}"))?;

        let mut rendered = template.clone();
        for (name, value) in vars {
            let placeholder = format!("{{{{{name}}}}}");
            rendered = rendered.replace(&placeholder, value);
        }

        Ok(rendered)
    }
}

fn generate_key(base_path: &Path, file_path: &Path) -> Result<String> {
    let relative = file_path
        .strip_prefix(base_path)
        .with_context(|| "failed to compute prompt relative path")?;

    let mut parts: Vec<String> = relative
        .iter()
        .map(|segment| segment.to_string_lossy().to_string())
        .collect();

    let file_name = parts
        .pop()
        .with_context(|| "invalid prompt file name")?
        .trim_end_matches(".txt")
        .to_string();

    let cleaned_file_name = strip_numeric_prefix(&file_name);
    if parts.is_empty() {
        return Ok(cleaned_file_name);
    }

    parts.push(cleaned_file_name);
    let key = parts.join("/").replace('\\', "/");
    Ok(key)
}

fn strip_numeric_prefix(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut idx = 0usize;

    while idx < bytes.len() && bytes[idx].is_ascii_digit() {
        idx += 1;
    }

    if idx < bytes.len() && bytes[idx] == b'.' {
        value[idx + 1..].to_string()
    } else {
        value.to_string()
    }
}

#[allow(dead_code)]
fn _as_path_buf(path: &Path) -> PathBuf {
    path.to_path_buf()
}
