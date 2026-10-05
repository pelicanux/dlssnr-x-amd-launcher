//! Discover installed games and reuse their existing artwork before online fallback.
use serde_json::Value;
use std::{collections::HashMap, fs, path::Path};

#[derive(Debug)]
pub(super) struct StoreGame {
    pub name: String,
    pub path: String,
    pub cover: Option<String>,
}

fn read_json(path: &Path) -> Option<Value> {
    serde_json::from_slice(&fs::read(path).ok()?).ok()
}

fn artwork(item: &Value) -> Option<String> {
    for key in ["art_square", "art_cover"] {
        if let Some(url) = item[key].as_str().filter(|url| {
            url.starts_with("https://") || url.starts_with("http://") || url.starts_with("file://")
        }) {
            return Some(url.to_string());
        }
    }
    let images = item.pointer("/metadata/keyImages")?.as_array()?;
    [
        "DieselGameBoxTall",
        "OfferImageTall",
        "DieselStoreFrontTall",
    ]
    .iter()
    .find_map(|kind| {
        images
            .iter()
            .filter(|image| image["type"].as_str() == Some(kind))
            .find_map(|image| {
                image["url"]
                    .as_str()
                    .filter(|url| url.starts_with("https://"))
                    .map(str::to_string)
            })
    })
}

fn entries(value: &Value) -> Vec<(String, &Value)> {
    if let Some(items) = value.as_array() {
        return items
            .iter()
            .map(|item| (item["app_name"].as_str().unwrap_or("").to_string(), item))
            .collect();
    }
    for key in ["installed", "games", "library"] {
        if let Some(items) = value.get(key) {
            if items.is_array() || items.is_object() {
                return entries(items);
            }
        }
    }
    value
        .as_object()
        .map(|items| {
            items
                .iter()
                .filter(|(id, item)| !id.starts_with("__") && item.is_object())
                .map(|(id, item)| (id.clone(), item))
                .collect()
        })
        .unwrap_or_default()
}

fn installed_game(item: &Value, metadata: Option<&Value>) -> Option<StoreGame> {
    if item["is_installed"] == false || item["install"]["is_dlc"] == true || item["is_dlc"] == true
    {
        return None;
    }
    let path = item["install_path"]
        .as_str()
        .or_else(|| item["installPath"].as_str())
        .or_else(|| {
            item.pointer("/install/install_path")
                .and_then(Value::as_str)
        })
        .or_else(|| item["folder_name"].as_str())?;
    if path.is_empty() || !Path::new(path).is_dir() {
        return None;
    }
    let name = item["title"]
        .as_str()
        .or_else(|| item["appName"].as_str())
        .or_else(|| metadata.and_then(|value| value["title"].as_str()))
        .or_else(|| metadata.and_then(|value| value["app_title"].as_str()))?;
    Some(StoreGame {
        name: name.to_string(),
        path: path.to_string(),
        cover: artwork(item).or_else(|| metadata.and_then(artwork)),
    })
}

pub(super) fn scan(base: &Path) -> Vec<StoreGame> {
    let mut games: Vec<StoreGame> = Vec::new();
    // Store IDs are only matched within the same store, avoiding cross-store collisions.
    for (installed_files, library_file) in [
        (
            &[
                "legendaryConfig/legendary/installed.json",
                "legendaryConfig/installed.json",
            ][..],
            "store_cache/legendary_library.json",
        ),
        (
            &["gog_store/installed.json"][..],
            "store_cache/gog_library.json",
        ),
        (
            &["nile_config/installed.json"][..],
            "store_cache/nile_library.json",
        ),
        (
            &[
                "sideload_store/installed.json",
                "sideloads.json",
                "sideload_apps/library.json",
            ][..],
            "sideload_apps/library.json",
        ),
    ] {
        let library = read_json(&base.join(library_file));
        let metadata: HashMap<_, _> = library
            .as_ref()
            .map(entries)
            .unwrap_or_default()
            .into_iter()
            .collect();
        let mut records = Vec::new();
        for relative in installed_files {
            if let Some(installed) = read_json(&base.join(relative)) {
                for (id, item) in entries(&installed) {
                    let store_metadata = metadata.get(&id).copied();
                    let epic_metadata = if library_file.contains("legendary")
                        && !id.is_empty()
                        && !id.contains(['/', '\\'])
                    {
                        read_json(
                            &base
                                .join("legendaryConfig/legendary/metadata")
                                .join(format!("{id}.json")),
                        )
                    } else {
                        None
                    };
                    if let Some(game) =
                        installed_game(item, store_metadata.or(epic_metadata.as_ref()))
                    {
                        records.push(game);
                    }
                }
            }
        }
        // Cached libraries can also carry installation paths for newer Heroic versions.
        if let Some(library) = &library {
            for (_, item) in entries(library) {
                if let Some(game) = installed_game(item, None) {
                    records.push(game);
                }
            }
        }
        for game in records {
            if let Some(existing) = games.iter_mut().find(|existing| existing.path == game.path) {
                if existing.cover.is_none() {
                    existing.cover = game.cover;
                }
            } else {
                games.push(game);
            }
        }
    }
    games
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn reuses_http_and_local_artwork_before_online_fallback() {
        let game = installed_game(
            &json!({"title":"FC 26", "install_path":"/tmp", "art_cover":"https://cdn.test/fc.png"}),
            None,
        )
        .unwrap();
        assert_eq!(game.cover.as_deref(), Some("https://cdn.test/fc.png"));
        assert_eq!(
            artwork(&json!({"art_square":"file:///tmp/my-cover.jpg"})).as_deref(),
            Some("file:///tmp/my-cover.jpg")
        );
        let metadata = json!({"art_square":"https://cdn.test/epic.jpg"});
        let game = installed_game(
            &json!({"title":"Epic Game", "install_path":"/tmp"}),
            Some(&metadata),
        )
        .unwrap();
        assert_eq!(game.cover.as_deref(), Some("https://cdn.test/epic.jpg"));
    }
    #[test]
    fn understands_installed_maps_and_cached_arrays() {
        assert_eq!(entries(&json!({"epic-id":{"title":"A"}}))[0].0, "epic-id");
        assert_eq!(
            entries(&json!({"installed":[{"app_name":"gog-id"}]}))[0].0,
            "gog-id"
        );
        assert_eq!(
            entries(&json!({"library":[{"app_name":"epic-id"}],"__timestamp":{}}))[0].0,
            "epic-id"
        );
    }
    #[test]
    fn uninstalled_games_and_dlcs_are_excluded() {
        assert!(installed_game(
            &json!({"title":"A","install_path":"/tmp","is_installed":false}),
            None
        )
        .is_none());
        assert!(installed_game(
            &json!({"title":"A","install_path":"/tmp","is_dlc":true}),
            None
        )
        .is_none());
    }
}
