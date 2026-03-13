use crate::rag::classifier::ClassifiedFile;
use text_splitter::{ChunkConfig, CodeSplitter, MarkdownSplitter, TextSplitter};
use tree_sitter::Language;

#[derive(Clone)]
pub struct SplitChunk {
    pub text: String,
    pub start_line: Option<usize>,
    pub end_line: Option<usize>,
}

pub fn split_document(classified: &ClassifiedFile, content: &str) -> Vec<SplitChunk> {
    if content.trim().is_empty() {
        return Vec::new();
    }

    let chunks = split_with_library(classified, content)
        .into_iter()
        .map(|chunk| chunk.trim().to_string())
        .filter(|chunk| !chunk.is_empty())
        .collect::<Vec<_>>();

    chunks
        .into_iter()
        .map(|text| SplitChunk {
            text,
            start_line: None,
            end_line: None,
        })
        .collect()
}

fn split_with_library(classified: &ClassifiedFile, content: &str) -> Vec<String> {
    match classified.kind.as_str() {
        "markdown" => {
            let splitter = MarkdownSplitter::new(ChunkConfig::new(1200));
            splitter.chunks(content).map(str::to_string).collect()
        }
        "code" => {
            let Some(language) = map_tree_sitter_language(&classified.language) else {
                let fallback = TextSplitter::new(ChunkConfig::new(800));
                return fallback.chunks(content).map(str::to_string).collect();
            };

            match CodeSplitter::new(language, ChunkConfig::new(800)) {
                Ok(splitter) => splitter.chunks(content).map(str::to_string).collect(),
                Err(_) => {
                    let fallback = TextSplitter::new(ChunkConfig::new(800));
                    fallback.chunks(content).map(str::to_string).collect()
                }
            }
        }
        _ => {
            let splitter = TextSplitter::new(ChunkConfig::new(1000));
            splitter.chunks(content).map(str::to_string).collect()
        }
    }
}

fn map_tree_sitter_language(value: &str) -> Option<Language> {
    match value {
        "python" => Some(tree_sitter_python::LANGUAGE.into()),
        "javascript" | "javascript-react" => Some(tree_sitter_javascript::LANGUAGE.into()),
        "typescript" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "typescript-react" => Some(tree_sitter_typescript::LANGUAGE_TSX.into()),
        "rust" => Some(tree_sitter_rust::LANGUAGE.into()),
        "go" => Some(tree_sitter_go::LANGUAGE.into()),
        "java" => Some(tree_sitter_java::LANGUAGE.into()),
        "cpp" | "c" => Some(tree_sitter_cpp::LANGUAGE.into()),
        _ => None,
    }
}
