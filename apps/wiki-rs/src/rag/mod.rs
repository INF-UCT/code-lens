mod classifier;
pub mod qdrant;
mod splitter;

use crate::llm::LlmClient;
use crate::models::{PreparedDoc, RetrievedChunk, WikiPage};
use anyhow::Result;
use classifier::{ClassifiedFile, classify_file};
use qdrant::QdrantClient;
use splitter::split_document as split_text;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use tokio::fs;
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Clone)]
pub struct RagEngine {
    qdrant: QdrantClient,
    llm: LlmClient,
}

impl RagEngine {
    pub fn new(qdrant: QdrantClient, llm: LlmClient) -> Self {
        Self { qdrant, llm }
    }

    pub async fn new_indexation(&self, project_id: Uuid, project_path: &Path) -> Result<()> {
        self.qdrant.ensure_collection().await?;
        self.qdrant.delete_project_vectors(project_id).await?;

        let mut chunks = Vec::new();

        for entry in WalkDir::new(project_path) {
            let entry = entry?;
            if !entry.file_type().is_file() {
                continue;
            }

            let full_path = entry.path();
            let Some(classified) = classify_file(project_id, project_path, full_path) else {
                continue;
            };

            let content = match fs::read_to_string(full_path).await {
                Ok(value) => value,
                Err(_) => continue,
            };

            let file_chunks = split_chunks(&classified, &content);
            chunks.extend(file_chunks);
        }

        if chunks.is_empty() {
            return Ok(());
        }

        let texts: Vec<String> = chunks.iter().map(|chunk| chunk.text.clone()).collect();
        let embeddings = self.llm.embed_texts(&texts).await?;

        let prepared_docs = chunks
            .into_iter()
            .zip(embeddings)
            .map(|(chunk, embedding)| PreparedDoc {
                id: chunk.id,
                text: chunk.text,
                metadata: chunk.metadata,
                embedding,
            })
            .collect::<Vec<_>>();

        self.qdrant.upsert_documents(prepared_docs).await?;
        Ok(())
    }

    pub async fn retrieve_page_context(
        &self,
        project_id: Uuid,
        section_title: &str,
        page: &WikiPage,
    ) -> Result<Vec<RetrievedChunk>> {
        let query = build_query(section_title, page);
        let query_embedding = self
            .llm
            .embed_texts(&[query])
            .await?
            .into_iter()
            .next()
            .unwrap_or_default();

        if query_embedding.is_empty() {
            return Ok(Vec::new());
        }

        let mut chunks = self
            .qdrant
            .search_by_project(project_id, &query_embedding, 40)
            .await?;

        let relevant_paths: HashSet<String> = page
            .relevant_files
            .iter()
            .map(|item| item.replace('\\', "/"))
            .collect();

        chunks.sort_by(|a, b| {
            let a_boost = if relevant_paths.contains(&a.source) {
                a.score + 0.15
            } else {
                a.score
            };

            let b_boost = if relevant_paths.contains(&b.source) {
                b.score + 0.15
            } else {
                b.score
            };

            b_boost
                .partial_cmp(&a_boost)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut dedup = Vec::new();
        let mut seen = HashSet::new();
        let mut file_counter: HashMap<String, usize> = HashMap::new();

        for chunk in chunks {
            let key = format!(
                "{}:{}:{}:{}",
                chunk.source,
                chunk.chunk_index,
                chunk.start_line.unwrap_or_default(),
                chunk.end_line.unwrap_or_default()
            );

            if seen.contains(&key) {
                continue;
            }

            let count = file_counter.entry(chunk.source.clone()).or_insert(0);
            if *count >= 3 {
                continue;
            }

            *count += 1;
            seen.insert(key);
            dedup.push(chunk);

            if dedup.len() >= 14 {
                break;
            }
        }

        Ok(dedup)
    }
}

fn build_query(section_title: &str, page: &WikiPage) -> String {
    format!(
        "Section: {section}\n\nPage title: {title}\n\nPage description: {description}\n\nRelevant files:\n{files}",
        section = section_title,
        title = page.title,
        description = page.description,
        files = page.relevant_files.join("\n")
    )
}

#[derive(Clone)]
struct Chunk {
    id: String,
    text: String,
    metadata: HashMap<String, serde_json::Value>,
}

fn build_chunk(
    classified: &ClassifiedFile,
    chunk_index: usize,
    text: String,
    start_line: Option<usize>,
    end_line: Option<usize>,
) -> Chunk {
    let mut metadata = HashMap::new();
    metadata.insert(
        "projectId".to_string(),
        serde_json::Value::String(classified.project_id.to_string()),
    );
    metadata.insert(
        "source".to_string(),
        serde_json::Value::String(classified.relative_path.clone()),
    );
    metadata.insert(
        "kind".to_string(),
        serde_json::Value::String(classified.kind.clone()),
    );
    metadata.insert(
        "language".to_string(),
        serde_json::Value::String(classified.language.clone()),
    );
    metadata.insert(
        "chunkIndex".to_string(),
        serde_json::Value::Number((chunk_index as u64).into()),
    );

    if let Some(line) = start_line {
        metadata.insert(
            "startLine".to_string(),
            serde_json::Value::Number((line as u64).into()),
        );
    }

    if let Some(line) = end_line {
        metadata.insert(
            "endLine".to_string(),
            serde_json::Value::Number((line as u64).into()),
        );
    }

    Chunk {
        id: Uuid::new_v4().to_string(),
        text,
        metadata,
    }
}

fn split_chunks(classified: &ClassifiedFile, content: &str) -> Vec<Chunk> {
    let splits = split_text(classified, content);

    splits
        .into_iter()
        .enumerate()
        .map(|(index, split)| {
            build_chunk(
                classified,
                index,
                split.text,
                split.start_line,
                split.end_line,
            )
        })
        .collect()
}
