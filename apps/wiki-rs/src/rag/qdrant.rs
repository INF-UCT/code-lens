use crate::models::{PreparedDoc, RetrievedChunk};
use anyhow::{Result, anyhow};
use reqwest::Client;
use serde_json::{Value, json};
use uuid::Uuid;

#[derive(Clone)]
pub struct QdrantClient {
    http: Client,
    base_url: String,
    collection_name: String,
}

impl QdrantClient {
    pub fn new(base_url: String) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            collection_name: "wiki".to_string(),
        }
    }

    pub async fn ensure_collection(&self) -> Result<()> {
        let collection_url = format!("{}/collections/{}", self.base_url, self.collection_name);

        let exists = self.http.get(&collection_url).send().await?;
        if exists.status().is_success() {
            return Ok(());
        }

        let body = json!({
            "vectors": {
                "size": 768,
                "distance": "Cosine"
            }
        });

        let response = self.http.put(&collection_url).json(&body).send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let response_body = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "failed to create qdrant collection ({status}): {response_body}"
            ));
        }

        Ok(())
    }

    pub async fn delete_project_vectors(&self, project_id: Uuid) -> Result<()> {
        let url = format!(
            "{}/collections/{}/points/delete?wait=true",
            self.base_url, self.collection_name
        );

        let body = json!({
            "filter": {
                "must": [
                    {
                        "key": "metadata.projectId",
                        "match": { "value": project_id }
                    }
                ]
            }
        });

        let response = self.http.post(url).json(&body).send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let response_body = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "failed to delete qdrant points ({status}): {response_body}"
            ));
        }

        Ok(())
    }

    pub async fn upsert_documents(&self, docs: Vec<PreparedDoc>) -> Result<()> {
        if docs.is_empty() {
            return Ok(());
        }

        let url = format!(
            "{}/collections/{}/points?wait=true",
            self.base_url, self.collection_name
        );

        let points = docs
            .into_iter()
            .map(|doc| {
                json!({
                    "id": doc.id,
                    "vector": doc.embedding,
                    "payload": {
                        "pageContent": doc.text,
                        "metadata": doc.metadata
                    }
                })
            })
            .collect::<Vec<_>>();

        let body = json!({ "points": points });
        let response = self.http.put(url).json(&body).send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let response_body = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "failed to upsert qdrant points ({status}): {response_body}"
            ));
        }

        Ok(())
    }

    pub async fn search_by_project(
        &self,
        project_id: Uuid,
        vector: &[f32],
        top_k: usize,
    ) -> Result<Vec<RetrievedChunk>> {
        let url = format!(
            "{}/collections/{}/points/search",
            self.base_url, self.collection_name
        );

        let body = json!({
            "vector": vector,
            "limit": top_k,
            "with_payload": true,
            "filter": {
                "must": [
                    {
                        "key": "metadata.projectId",
                        "match": { "value": project_id }
                    }
                ]
            }
        });

        let response = self.http.post(url).json(&body).send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let response_body = response.text().await.unwrap_or_default();
            return Err(anyhow!("qdrant search failed ({status}): {response_body}"));
        }

        let payload: Value = response.json().await?;
        let result = payload
            .get("result")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut chunks = Vec::new();
        for item in result {
            let score = item.get("score").and_then(Value::as_f64).unwrap_or(0.0) as f32;

            let payload = item.get("payload").cloned().unwrap_or_else(|| json!({}));
            let metadata = payload
                .get("metadata")
                .cloned()
                .unwrap_or_else(|| json!({}));

            let content = payload
                .get("pageContent")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();

            let source = metadata
                .get("source")
                .and_then(Value::as_str)
                .unwrap_or("unknown")
                .replace('\\', "/");

            let chunk = RetrievedChunk {
                content,
                source,
                kind: metadata
                    .get("kind")
                    .and_then(Value::as_str)
                    .unwrap_or("text")
                    .to_string(),
                language: metadata
                    .get("language")
                    .and_then(Value::as_str)
                    .unwrap_or("none")
                    .to_string(),
                chunk_index: metadata
                    .get("chunkIndex")
                    .and_then(Value::as_u64)
                    .unwrap_or(0) as usize,
                start_line: metadata
                    .get("startLine")
                    .and_then(Value::as_u64)
                    .map(|value| value as usize),
                end_line: metadata
                    .get("endLine")
                    .and_then(Value::as_u64)
                    .map(|value| value as usize),
                score,
            };

            chunks.push(chunk);
        }

        Ok(chunks)
    }
}
