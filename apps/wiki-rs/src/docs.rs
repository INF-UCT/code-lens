use crate::agents::writer::{WriterAgent, WriterInput};
use crate::models::{PageGenerationError, RetrievedChunk, WikiPage, WikiSection, WikiStructure};
use crate::rag::RagEngine;
use anyhow::Result;
use slug::slugify;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use uuid::Uuid;

#[derive(Debug)]
pub struct GeneratedDocsResult {
    pub output_dir: PathBuf,
    pub generated_pages: usize,
    pub errors: Vec<PageGenerationError>,
}

#[derive(Clone)]
pub struct DocumentationGenerator {
    writer: WriterAgent,
    rag: RagEngine,
}

impl DocumentationGenerator {
    pub fn new(writer: WriterAgent, rag: RagEngine) -> Self {
        Self { writer, rag }
    }

    pub async fn generate(
        &self,
        output_root: &Path,
        repo_id: Uuid,
        planner_output: WikiStructure,
    ) -> Result<GeneratedDocsResult> {
        let output_dir = output_root.join(repo_id.to_string());
        let _ = fs::remove_dir_all(&output_dir).await;
        fs::create_dir_all(&output_dir).await?;

        let section_map = planner_output
            .sections
            .iter()
            .map(|section| (section.id.clone(), section.clone()))
            .collect::<HashMap<_, _>>();

        let page_map = planner_output
            .pages
            .iter()
            .map(|page| (page.id.clone(), page.clone()))
            .collect::<HashMap<_, _>>();

        let ordered_pages = order_pages(&planner_output.sections, &page_map);
        let mut generated_files = HashMap::new();
        let mut errors = Vec::new();

        for (index, page) in ordered_pages.iter().enumerate() {
            let section_title = resolve_section_title(page, &section_map);
            let file_name = format!("{:02}-{}.md", index + 1, to_slug(&page.title));
            let output_path = output_dir.join(&file_name);

            let operation = async {
                let context_chunks = self
                    .rag
                    .retrieve_page_context(repo_id, &section_title, page)
                    .await?;

                let input = WriterInput {
                    project_overview: format!(
                        "{}\n\n{}",
                        planner_output.title, planner_output.description
                    ),
                    project_features: build_project_features(&planner_output.sections),
                    page_title: page.title.clone(),
                    page_description: page.description.clone(),
                    section_title,
                    relevant_sources: build_relevant_sources(&context_chunks),
                    files_content: build_files_content(&context_chunks),
                };

                let markdown = self.writer.run(input).await?;
                fs::write(&output_path, markdown).await?;

                Ok::<(), anyhow::Error>(())
            }
            .await;

            match operation {
                Ok(_) => {
                    generated_files.insert(page.id.clone(), file_name);
                }
                Err(error) => {
                    errors.push(PageGenerationError {
                        page_id: page.id.clone(),
                        page_title: page.title.clone(),
                        error: error.to_string(),
                    });
                }
            }
        }

        write_index_file(&output_dir, &planner_output, &generated_files).await?;

        Ok(GeneratedDocsResult {
            output_dir,
            generated_pages: generated_files.len(),
            errors,
        })
    }
}

fn order_pages(sections: &[WikiSection], page_map: &HashMap<String, WikiPage>) -> Vec<WikiPage> {
    let mut ordered = Vec::new();
    let mut used = std::collections::HashSet::new();

    for section in sections {
        for page_id in &section.pages {
            let Some(page) = page_map.get(page_id) else {
                continue;
            };

            if used.contains(&page.id) {
                continue;
            }

            ordered.push(page.clone());
            used.insert(page.id.clone());
        }
    }

    for page in page_map.values() {
        if used.contains(&page.id) {
            continue;
        }

        ordered.push(page.clone());
        used.insert(page.id.clone());
    }

    ordered
}

fn resolve_section_title(page: &WikiPage, section_map: &HashMap<String, WikiSection>) -> String {
    let Some(parent) = &page.parent_section else {
        return "General".to_string();
    };

    section_map
        .get(parent)
        .map(|section| section.title.clone())
        .unwrap_or_else(|| "General".to_string())
}

fn build_project_features(sections: &[WikiSection]) -> String {
    if sections.is_empty() {
        return "- Sin secciones detectadas".to_string();
    }

    sections
        .iter()
        .map(|section| format!("- {}", section.title))
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_relevant_sources(chunks: &[RetrievedChunk]) -> String {
    if chunks.is_empty() {
        return "- No se recuperaron fuentes".to_string();
    }

    chunks
        .iter()
        .map(|chunk| {
            let line_range = match (chunk.start_line, chunk.end_line) {
                (Some(start), Some(end)) => format!("#L{start}-L{end}"),
                _ => String::new(),
            };

            format!(
                "- {}{} (score={:.4})",
                chunk.source, line_range, chunk.score
            )
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn build_files_content(chunks: &[RetrievedChunk]) -> String {
    if chunks.is_empty() {
        return "[SOURCE: none]\nNo hay contexto recuperado para esta pagina.\n[/SOURCE]"
            .to_string();
    }

    chunks
        .iter()
        .map(|chunk| {
            let line_range = match (chunk.start_line, chunk.end_line) {
                (Some(start), Some(end)) => format!("{start}-{end}"),
                _ => "n/a".to_string(),
            };

            [
                format!(
                    "[SOURCE: {} | kind={} | language={} | lines={} | score={:.4}]",
                    chunk.source, chunk.kind, chunk.language, line_range, chunk.score
                ),
                chunk.content.clone(),
                "[/SOURCE]".to_string(),
            ]
            .join("\n")
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

async fn write_index_file(
    output_dir: &Path,
    structure: &WikiStructure,
    generated_files: &HashMap<String, String>,
) -> Result<()> {
    let mut lines = Vec::new();
    lines.push(format!("# {}", structure.title));
    lines.push(String::new());
    lines.push(structure.description.clone());
    lines.push(String::new());
    lines.push("## Estructura de documentacion".to_string());
    lines.push(String::new());

    for section in &structure.sections {
        lines.push(format!("### {}", section.title));

        for page_id in &section.pages {
            let page = structure.pages.iter().find(|item| item.id == *page_id);
            let file_name = generated_files.get(page_id);

            let (Some(page), Some(file_name)) = (page, file_name) else {
                continue;
            };

            lines.push(format!("- [{}](./{})", page.title, file_name));
        }

        lines.push(String::new());
    }

    let index_path = output_dir.join("README.md");
    let content = format!("{}\n", lines.join("\n").trim());
    fs::write(index_path, content).await?;

    Ok(())
}

fn to_slug(value: &str) -> String {
    let slugged = slugify(value);
    if slugged.is_empty() {
        "documentacion".to_string()
    } else {
        slugged
    }
}
