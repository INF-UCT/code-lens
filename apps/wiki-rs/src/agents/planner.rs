use crate::llm::LlmClient;
use crate::models::WikiStructure;
use crate::prompts::PromptStore;
use anyhow::{Context, Result};
use std::path::Path;
use tokio::fs;

#[derive(Clone)]
pub struct PlannerAgent {
    llm: LlmClient,
    prompts: PromptStore,
}

impl PlannerAgent {
    pub fn new(llm: LlmClient, prompts: PromptStore) -> Self {
        Self { llm, prompts }
    }

    pub async fn run(&self, project_path: &str, project_tree: &str) -> Result<WikiStructure> {
        let readme_path = Path::new(project_path).join("README.md");
        let readme = fs::read_to_string(&readme_path)
            .await
            .with_context(|| format!("Failed to read {}", readme_path.display()))?;

        let prompt = self.prompts.render(
            "planner/planner",
            &[("fileTree", project_tree.to_string()), ("readme", readme)],
        )?;

        self.llm
            .chat_structured::<WikiStructure>(&prompt, "wiki_structure", 0.0, Some(3000))
            .await
            .with_context(|| "Planner output is not valid WikiStructure JSON")
    }
}
