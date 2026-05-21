use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

use crate::state::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionQuery {
    pub folder: Option<String>,
    pub text: Option<String>,
    pub property_filters: Option<Vec<CollectionPropertyFilter>>,
    pub sort: Option<CollectionSort>,
    pub limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionPropertyFilter {
    pub key: String,
    pub op: Option<String>,
    pub value: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionSort {
    pub field: String,
    pub direction: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItem {
    pub path: String,
    pub title: String,
    pub excerpt: String,
    pub properties: BTreeMap<String, Value>,
    pub tags: Vec<String>,
    pub modified_at: String,
    pub word_count: usize,
}

#[tauri::command]
pub async fn list_collection_items(
    query: CollectionQuery,
    state: State<'_, AppState>,
) -> Result<Vec<CollectionItem>, String> {
    state.with_workspace(|workspace| {
        let folder = query
            .folder
            .as_deref()
            .map(normalize_folder)
            .filter(|value| !value.is_empty());
        let text = query
            .text
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_lowercase);
        let search_hits = text
            .as_deref()
            .and_then(|text| workspace.db.search(text).ok())
            .map(|results| {
                results
                    .into_iter()
                    .map(|result| result.path)
                    .collect::<std::collections::BTreeSet<_>>()
            });
        let filters = query.property_filters.unwrap_or_default();
        let mut items: Vec<_> = workspace
            .db
            .collection_items()
            .map_err(|error| error.to_string())?
            .into_iter()
            .filter(|item| {
                if let Some(folder) = folder.as_deref() {
                    if !item.path.starts_with(folder) {
                        return false;
                    }
                }
                if let Some(text) = text.as_deref() {
                    let haystack = collection_haystack(item);
                    let matched_text = haystack.contains(text)
                        || search_hits
                            .as_ref()
                            .is_some_and(|hits| hits.contains(&item.path));
                    if !matched_text {
                        return false;
                    }
                }
                filters.iter().all(|filter| property_matches(item, filter))
            })
            .map(|item| CollectionItem {
                path: item.path,
                title: item.title,
                excerpt: item.excerpt,
                properties: item.properties,
                tags: item.tags,
                modified_at: item.modified_at,
                word_count: item.word_count,
            })
            .collect();

        sort_items(&mut items, query.sort.as_ref());
        if let Some(limit) = query.limit {
            items.truncate(limit.clamp(1, 1000));
        }
        Ok(items)
    })
}

fn normalize_folder(folder: &str) -> String {
    folder
        .replace('\\', "/")
        .trim()
        .trim_start_matches('/')
        .trim_end_matches('/')
        .to_string()
}

fn collection_haystack(item: &lattice_db::repositories::DbCollectionRow) -> String {
    let properties = item
        .properties
        .iter()
        .map(|(key, value)| format!("{key} {}", value_to_string(value)))
        .collect::<Vec<_>>()
        .join(" ");
    format!(
        "{} {} {} {} {}",
        item.path,
        item.title,
        item.excerpt,
        item.tags.join(" "),
        properties
    )
    .to_lowercase()
}

fn property_matches(
    item: &lattice_db::repositories::DbCollectionRow,
    filter: &CollectionPropertyFilter,
) -> bool {
    let key = filter.key.trim();
    if key.is_empty() {
        return true;
    }
    let actual = field_value(item, key);
    let op = filter.op.as_deref().unwrap_or("eq");
    if op == "exists" {
        return actual.is_some_and(|value| !value.is_null());
    }
    let expected = filter.value.as_ref().unwrap_or(&Value::Null);
    let Some(actual) = actual else {
        return op == "neq";
    };

    match op {
        "eq" | "=" | "==" => values_equal(actual, expected),
        "neq" | "!=" => !values_equal(actual, expected),
        "contains" => value_to_string(actual)
            .to_lowercase()
            .contains(&value_to_string(expected).to_lowercase()),
        "gt" | ">" => compare_values(actual, expected).is_some_and(|ordering| ordering.is_gt()),
        "gte" | ">=" => compare_values(actual, expected).is_some_and(|ordering| {
            matches!(
                ordering,
                std::cmp::Ordering::Greater | std::cmp::Ordering::Equal
            )
        }),
        "lt" | "<" => compare_values(actual, expected).is_some_and(|ordering| ordering.is_lt()),
        "lte" | "<=" => compare_values(actual, expected).is_some_and(|ordering| {
            matches!(
                ordering,
                std::cmp::Ordering::Less | std::cmp::Ordering::Equal
            )
        }),
        _ => values_equal(actual, expected),
    }
}

fn sort_items(items: &mut [CollectionItem], sort: Option<&CollectionSort>) {
    let Some(sort) = sort else {
        items.sort_by(|a, b| {
            b.modified_at
                .cmp(&a.modified_at)
                .then_with(|| a.path.cmp(&b.path))
        });
        return;
    };
    let field = sort.field.trim();
    let desc = sort
        .direction
        .as_deref()
        .map(|direction| !direction.eq_ignore_ascii_case("asc"))
        .unwrap_or(true);
    items.sort_by(|a, b| {
        let left = collection_item_field(a, field);
        let right = collection_item_field(b, field);
        let ordering = compare_values(&left, &right)
            .unwrap_or_else(|| value_to_string(&left).cmp(&value_to_string(&right)));
        if desc { ordering.reverse() } else { ordering }.then_with(|| a.path.cmp(&b.path))
    });
}

fn field_value<'a>(
    item: &'a lattice_db::repositories::DbCollectionRow,
    key: &str,
) -> Option<&'a Value> {
    item.properties.get(key)
}

fn collection_item_field(item: &CollectionItem, field: &str) -> Value {
    match field {
        "title" => Value::String(item.title.clone()),
        "path" => Value::String(item.path.clone()),
        "modifiedAt" | "modified_at" | "mtime" => Value::String(item.modified_at.clone()),
        "wordCount" | "word_count" => Value::Number((item.word_count as u64).into()),
        "tags" => Value::Array(item.tags.iter().cloned().map(Value::String).collect()),
        key => item.properties.get(key).cloned().unwrap_or(Value::Null),
    }
}

fn values_equal(actual: &Value, expected: &Value) -> bool {
    if actual == expected {
        return true;
    }
    value_to_string(actual).eq_ignore_ascii_case(&value_to_string(expected))
}

fn compare_values(left: &Value, right: &Value) -> Option<std::cmp::Ordering> {
    if let (Some(a), Some(b)) = (left.as_f64(), right.as_f64()) {
        return a.partial_cmp(&b);
    }
    Some(value_to_string(left).cmp(&value_to_string(right)))
}

fn value_to_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values
            .iter()
            .map(value_to_string)
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join(", "),
        Value::Object(_) => value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lattice_db::repositories::DbCollectionRow;
    use serde_json::json;

    fn row(path: &str, title: &str, properties: BTreeMap<String, Value>) -> DbCollectionRow {
        DbCollectionRow {
            path: path.to_string(),
            title: title.to_string(),
            excerpt: String::new(),
            properties,
            tags: Vec::new(),
            modified_at: "2026-05-21T00:00:00Z".to_string(),
            word_count: 100,
        }
    }

    #[test]
    fn collection_property_filters_match_common_frontmatter_values() {
        let item = row(
            "Projects/Alpha.md",
            "Alpha",
            BTreeMap::from([
                ("status".to_string(), json!("active")),
                ("priority".to_string(), json!(3)),
                ("archived".to_string(), json!(false)),
            ]),
        );

        assert!(property_matches(
            &item,
            &CollectionPropertyFilter {
                key: "status".to_string(),
                op: Some("eq".to_string()),
                value: Some(json!("active")),
            },
        ));
        assert!(property_matches(
            &item,
            &CollectionPropertyFilter {
                key: "priority".to_string(),
                op: Some("gte".to_string()),
                value: Some(json!(2)),
            },
        ));
        assert!(!property_matches(
            &item,
            &CollectionPropertyFilter {
                key: "archived".to_string(),
                op: Some("eq".to_string()),
                value: Some(json!(true)),
            },
        ));
    }

    #[test]
    fn collection_sort_uses_metadata_and_frontmatter_fields() {
        let mut items = vec![
            CollectionItem {
                path: "Projects/Beta.md".to_string(),
                title: "Beta".to_string(),
                excerpt: String::new(),
                properties: BTreeMap::from([("priority".to_string(), json!(1))]),
                tags: Vec::new(),
                modified_at: "2026-05-20T00:00:00Z".to_string(),
                word_count: 40,
            },
            CollectionItem {
                path: "Projects/Alpha.md".to_string(),
                title: "Alpha".to_string(),
                excerpt: String::new(),
                properties: BTreeMap::from([("priority".to_string(), json!(5))]),
                tags: Vec::new(),
                modified_at: "2026-05-21T00:00:00Z".to_string(),
                word_count: 80,
            },
        ];

        sort_items(
            &mut items,
            Some(&CollectionSort {
                field: "priority".to_string(),
                direction: Some("desc".to_string()),
            }),
        );
        assert_eq!(items[0].path, "Projects/Alpha.md");

        sort_items(
            &mut items,
            Some(&CollectionSort {
                field: "title".to_string(),
                direction: Some("asc".to_string()),
            }),
        );
        assert_eq!(items[0].title, "Alpha");
    }
}
