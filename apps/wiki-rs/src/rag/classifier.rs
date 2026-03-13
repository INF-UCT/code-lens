use std::path::Path;
use uuid::Uuid;

#[derive(Clone)]
pub struct ClassifiedFile {
    pub project_id: Uuid,
    pub relative_path: String,
    pub kind: String,
    pub language: String,
}

pub fn classify_file(project_id: Uuid, root: &Path, file_path: &Path) -> Option<ClassifiedFile> {
    let relative = file_path.strip_prefix(root).ok()?;
    let relative_path = relative.to_string_lossy().replace('\\', "/");

    if relative_path.contains("/.git/") || relative_path.ends_with("/.git") {
        return None;
    }

    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let (kind, language) = classify_extension(&extension);

    Some(ClassifiedFile {
        project_id,
        relative_path,
        kind: kind.to_string(),
        language: language.to_string(),
    })
}

fn classify_extension(extension: &str) -> (&'static str, &'static str) {
    match extension {
        "ts" => ("code", "typescript"),
        "tsx" => ("code", "typescript-react"),
        "js" => ("code", "javascript"),
        "jsx" => ("code", "javascript-react"),
        "py" => ("code", "python"),
        "go" => ("code", "go"),
        "java" => ("code", "java"),
        "c" | "h" => ("code", "c"),
        "cpp" | "hpp" => ("code", "cpp"),
        "rs" => ("code", "rust"),
        "proto" => ("code", "proto"),
        "md" => ("markdown", "none"),
        "csv" => ("csv", "none"),
        _ => ("text", "none"),
    }
}
