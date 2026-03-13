use crate::llm::LlmClient;
use crate::prompts::PromptStore;
use anyhow::Result;

#[derive(Clone)]
pub struct WriterAgent {
    llm: LlmClient,
    prompts: PromptStore,
}

#[derive(Clone)]
pub struct WriterInput {
    pub project_overview: String,
    pub project_features: String,
    pub page_title: String,
    pub page_description: String,
    pub section_title: String,
    pub relevant_sources: String,
    pub files_content: String,
}

impl WriterAgent {
    pub fn new(llm: LlmClient, prompts: PromptStore) -> Self {
        Self { llm, prompts }
    }

    pub async fn run(&self, input: WriterInput) -> Result<String> {
        let prompt = self.prompts.render(
            "writer/writer",
            &[
                ("project_overview", input.project_overview),
                ("project_features", input.project_features),
                ("page_title", input.page_title),
                ("section_title", input.section_title),
                ("page_description", input.page_description),
                ("relevant_sources", input.relevant_sources),
                ("files_content", input.files_content),
            ],
        )?;

        let markdown = self.llm.chat(&prompt, 0.1, Some(5000)).await?;
        Ok(markdown.trim().to_string())
    }
}
