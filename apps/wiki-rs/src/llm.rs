use anyhow::{Context, Result, anyhow};
use async_openai::Client;
use async_openai::config::OpenAIConfig;
use async_openai::types::chat::{
    ChatCompletionRequestMessage, ChatCompletionRequestUserMessageArgs,
    CreateChatCompletionRequest, CreateChatCompletionResponse, ResponseFormat,
    ResponseFormatJsonSchema,
};
use async_openai::types::embeddings::{CreateEmbeddingRequest, EmbeddingInput};
use schemars::JsonSchema;
use serde::de::DeserializeOwned;

const DEFAULT_CHAT_MODEL: &str = "qwen3.5:9b";
const DEFAULT_EMBED_MODEL: &str = "nomic-embed-text-v2-moe:latest";

#[derive(Clone)]
pub struct LlmClient {
    client: Client<OpenAIConfig>,
    chat_model: String,
    embed_model: String,
}

impl LlmClient {
    pub fn new(base_url: String) -> Self {
        let normalized = base_url.trim_end_matches('/').to_string();
        let config = OpenAIConfig::new()
            .with_api_base(normalized)
            .with_api_key("dummy");

        Self {
            client: Client::with_config(config),
            chat_model: DEFAULT_CHAT_MODEL.to_string(),
            embed_model: DEFAULT_EMBED_MODEL.to_string(),
        }
    }

    pub async fn check_connection(&self) -> Result<()> {
        self.client
            .models()
            .list()
            .await
            .with_context(|| "failed to connect to OpenAI-compatible endpoint")?;

        Ok(())
    }

    pub async fn chat(
        &self,
        prompt: &str,
        temperature: f32,
        max_tokens: Option<u32>,
    ) -> Result<String> {
        let message = build_user_message(prompt)?;

        let request = CreateChatCompletionRequest {
            model: self.chat_model.clone(),
            messages: vec![message],
            temperature: Some(temperature),
            max_completion_tokens: max_tokens,
            ..Default::default()
        };

        let response = self.client.chat().create(request).await?;
        extract_content(response)
    }

    pub async fn chat_structured<T>(
        &self,
        prompt: &str,
        schema_name: &str,
        temperature: f32,
        max_tokens: Option<u32>,
    ) -> Result<T>
    where
        T: DeserializeOwned + JsonSchema,
    {
        let schema = schemars::schema_for!(T);
        let schema_json = serde_json::to_value(&schema)?;

        let strict_format = ResponseFormat::JsonSchema {
            json_schema: ResponseFormatJsonSchema {
                description: Some("Structured output response schema".to_string()),
                name: schema_name.to_string(),
                schema: Some(schema_json),
                strict: Some(true),
            },
        };

        let response = self
            .chat_with_response_format(prompt, temperature, max_tokens, strict_format)
            .await;

        match response {
            Ok(raw) => parse_json::<T>(&raw),
            Err(_) => {
                let fallback = self
                    .chat_with_response_format(
                        prompt,
                        temperature,
                        max_tokens,
                        ResponseFormat::JsonObject,
                    )
                    .await?;

                parse_json::<T>(&fallback)
            }
        }
    }

    pub async fn embed_texts(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        let request = CreateEmbeddingRequest {
            model: self.embed_model.clone(),
            input: EmbeddingInput::StringArray(texts.to_vec()),
            ..Default::default()
        };

        let response = self.client.embeddings().create(request).await?;
        let mut vectors = vec![Vec::<f32>::new(); response.data.len()];

        for embedding in response.data {
            let index = embedding.index as usize;
            if index >= vectors.len() {
                return Err(anyhow!("invalid embedding index received"));
            }

            vectors[index] = embedding.embedding;
        }

        Ok(vectors)
    }

    async fn chat_with_response_format(
        &self,
        prompt: &str,
        temperature: f32,
        max_tokens: Option<u32>,
        response_format: ResponseFormat,
    ) -> Result<String> {
        let message = build_user_message(prompt)?;

        let request = CreateChatCompletionRequest {
            model: self.chat_model.clone(),
            messages: vec![message],
            temperature: Some(temperature),
            max_completion_tokens: max_tokens,
            response_format: Some(response_format),
            ..Default::default()
        };

        let response = self.client.chat().create(request).await?;
        extract_content(response)
    }
}

fn build_user_message(prompt: &str) -> Result<ChatCompletionRequestMessage> {
    ChatCompletionRequestUserMessageArgs::default()
        .content(prompt)
        .build()
        .map(ChatCompletionRequestMessage::User)
        .map_err(|error| anyhow!("failed to build user message: {error}"))
}

fn extract_content(response: CreateChatCompletionResponse) -> Result<String> {
    response
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .map(|content| content.trim().to_string())
        .filter(|content| !content.is_empty())
        .with_context(|| "empty LLM response content")
}

fn parse_json<T: DeserializeOwned>(raw: &str) -> Result<T> {
    if let Ok(value) = serde_json::from_str::<T>(raw) {
        return Ok(value);
    }

    if let (Some(start), Some(end)) = (raw.find('{'), raw.rfind('}')) {
        if end > start {
            let slice = &raw[start..=end];
            if let Ok(value) = serde_json::from_str::<T>(slice) {
                return Ok(value);
            }
        }
    }

    Err(anyhow!("failed to parse JSON from LLM output"))
}
