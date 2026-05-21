use regex::Regex;
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

pub fn parse_properties(content: &str) -> Vec<Property> {
    let mut properties = parse_frontmatter(content);
    properties.extend(parse_inline_properties(content));
    properties
}

fn parse_inline_properties(content: &str) -> Vec<Property> {
    let (_, body) = split_frontmatter(content);
    let line_field = Regex::new(r"^\s*([A-Za-z][A-Za-z0-9 _-]{0,63})::\s*(.+?)\s*$")
        .expect("valid inline property regex");
    let bracket_field = Regex::new(r"\[([A-Za-z][A-Za-z0-9 _-]{0,63})::\s*([^\]]+?)\]")
        .expect("valid bracket inline property regex");
    let mut properties = Vec::new();
    let mut in_fence = false;

    for line in body.lines() {
        let trimmed = line.trim_start();
        if trimmed.starts_with("```") || trimmed.starts_with("~~~") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }

        if let Some(captures) = line_field.captures(line) {
            if let (Some(key), Some(value)) = (captures.get(1), captures.get(2)) {
                properties.push(property_from_inline(key.as_str(), value.as_str()));
                continue;
            }
        }

        for captures in bracket_field.captures_iter(line) {
            if let (Some(key), Some(value)) = (captures.get(1), captures.get(2)) {
                properties.push(property_from_inline(key.as_str(), value.as_str()));
            }
        }
    }

    properties
}

fn property_from_inline(key: &str, value: &str) -> Property {
    let value = inline_value(value.trim());
    Property {
        key: key.trim().replace(' ', "-"),
        value_type: value_type(&value).to_string(),
        value,
    }
}

fn inline_value(value: &str) -> Value {
    if value.eq_ignore_ascii_case("true") {
        return Value::Bool(true);
    }
    if value.eq_ignore_ascii_case("false") {
        return Value::Bool(false);
    }
    if let Ok(number) = value.parse::<i64>() {
        return Value::Number(number.into());
    }
    if let Ok(number) = value.parse::<f64>() {
        if let Some(number) = serde_json::Number::from_f64(number) {
            return Value::Number(number);
        }
    }
    if value.contains(',') {
        return Value::Array(
            value
                .split(',')
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .map(|part| Value::String(part.to_string()))
                .collect(),
        );
    }
    Value::String(value.to_string())
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
