use serde_json::Value;

use crate::metadata::Property;

pub fn split_frontmatter(content: &str) -> (Option<&str>, &str) {
    if !content.starts_with("---\n") && !content.starts_with("---\r\n") {
        return (None, content);
    }

    let normalized = content.replace("\r\n", "\n");
    if let Some(end) = normalized[4..].find("\n---\n") {
        let fm_end = 4 + end;
        let body_start = fm_end + "\n---\n".len();
        let fm = &content[4..fm_end.min(content.len())];
        let body = &content[body_start.min(content.len())..];
        return (Some(fm), body);
    }

    (None, content)
}

pub fn parse_frontmatter(content: &str) -> Vec<Property> {
    let Some((frontmatter, _)) =
        Some(split_frontmatter(content)).filter(|(frontmatter, _)| frontmatter.is_some())
    else {
        return Vec::new();
    };
    let Some(frontmatter) = frontmatter else {
        return Vec::new();
    };

    let Ok(value) = serde_yaml::from_str::<serde_yaml::Value>(frontmatter) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::to_value(value) else {
        return Vec::new();
    };

    match json {
        Value::Object(map) => map
            .into_iter()
            .map(|(key, value)| Property {
                key,
                value_type: value_type(&value).to_string(),
                value,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn value_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}
