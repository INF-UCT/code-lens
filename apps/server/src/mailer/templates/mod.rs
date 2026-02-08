use std::collections::HashMap;

pub struct TemplateRenderer;

impl TemplateRenderer {
    pub fn render(template_name: &str, context: &HashMap<String, String>) -> String {
        let mut template = match template_name {
            "doc-gen" => include_str!("doc-gen.html"),
            "welcome" => include_str!("welcome.html"),
            _ => panic!("Template not found"),
        }
        .to_string();

        for (key, value) in context {
            let placeholder = format!("{{{{{}}}}}", key);
            template = template.replace(&placeholder, value);
        }

        template
    }
}
