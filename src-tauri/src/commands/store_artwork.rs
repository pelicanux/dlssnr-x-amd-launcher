//! Public store catalog searches. No launcher installation or account credentials required.
use reqwest::Client;
use serde_json::{json, Value};
use std::{sync::OnceLock, time::Duration};

pub(super) fn client() -> &'static Client {
    static CLIENT: OnceLock<Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        Client::builder()
            .user_agent("DLSSNR-X-AMD/0.7")
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(12))
            .build()
            .expect("valid store client configuration")
    })
}

fn normalized_title(title: &str) -> String {
    title
        .chars()
        .filter(|c| c.is_alphanumeric() && *c != '™' && *c != '®')
        .flat_map(char::to_lowercase)
        .collect()
}

/// Heroic/custom libraries may include the original release year. The PC
/// catalogs list the 2018 God of War simply as "God of War". Keep other games
/// and years intact so this alias cannot match Ragnarök or the 2005 original.
pub(super) fn catalog_title(title: &str) -> &str {
    if normalized_title(title) == "godofwar2018" {
        "God of War"
    } else {
        title
    }
}

fn without_brand(title: &str) -> &str {
    for prefix in ["disneypixar", "easports", "disney"] {
        if let Some(rest) = title.strip_prefix(prefix).filter(|rest| !rest.is_empty()) {
            return rest;
        }
    }
    title
}

pub(super) fn title_score(query: &str, title: &str) -> u8 {
    let query = normalized_title(catalog_title(query));
    let title = normalized_title(catalog_title(title));
    if query.is_empty() {
        return 0;
    }
    if query == title {
        return 100;
    }
    let query = without_brand(&query);
    let title = without_brand(&title);
    if query == title {
        return 95;
    }
    // Only allow known edition suffixes; a sequel, DLC or demo is a different game.
    const EDITIONS: &[&str] = &[
        "standardedition",
        "ultimateedition",
        "definitiveedition",
        "completeedition",
        "enhancededition",
        "goldedition",
        "deluxeedition",
        "gameoftheyearedition",
        "gotyedition",
    ];
    if query.len() >= 4
        && EDITIONS.iter().any(|edition| {
            title.strip_prefix(query) == Some(*edition)
                || query.strip_prefix(title) == Some(*edition)
        })
    {
        return 90;
    }
    0
}

fn image_url(value: &Value) -> Option<String> {
    let url = value.as_str()?;
    url.starts_with("https://").then(|| url.to_string())
}

fn epic_cover(name: &str, response: &Value) -> Option<String> {
    let elements = response
        .pointer("/data/Catalog/searchStore/elements")?
        .as_array()?;
    let mut candidates: Vec<_> = elements
        .iter()
        .filter_map(|game| {
            let score = title_score(name, game["title"].as_str()?);
            if score == 0 {
                return None;
            }
            let images = game["keyImages"].as_array()?;
            let cover = [
                "DieselGameBoxTall",
                "OfferImageTall",
                "DieselStoreFrontTall",
            ]
            .iter()
            .find_map(|kind| {
                images
                    .iter()
                    .filter(|image| image["type"].as_str() == Some(kind))
                    .find_map(|image| image_url(&image["url"]))
            })?;
            Some((score, cover))
        })
        .collect();
    candidates.sort_by(|a, b| b.0.cmp(&a.0));
    candidates.into_iter().next().map(|(_, url)| url)
}

fn gog_cover(name: &str, response: &Value) -> Option<String> {
    let products = response["products"].as_array()?;
    products
        .iter()
        .filter_map(|game| {
            let score = title_score(name, game["title"].as_str()?);
            (score > 0)
                .then_some(score)
                .zip(image_url(&game["coverVertical"]))
        })
        .max_by_key(|(score, _)| *score)
        .map(|(_, url)| url)
}

fn steam_asset_url(item: &Value) -> Option<String> {
    if item["success"].as_u64() != Some(1) {
        return None;
    }
    let app_id = item["appid"].as_u64()?;
    let assets = &item["assets"];
    let template = assets["asset_url_format"].as_str()?;
    let file = assets["library_capsule"].as_str()?;
    if !template.starts_with(&format!("steam/apps/{app_id}/"))
        || !template.contains("${FILENAME}")
        || file.is_empty()
        || file.contains("..")
    {
        return None;
    }
    Some(format!(
        "https://shared.akamai.steamstatic.com/store_item_assets/{}",
        template.replace("${FILENAME}", file)
    ))
}

pub(super) async fn fetch_steam_assets(app_ids: &[u32]) -> std::collections::HashMap<u32, String> {
    if app_ids.is_empty() {
        return Default::default();
    }
    let input = json!({"ids":app_ids.iter().map(|id| json!({"appid":id})).collect::<Vec<_>>(),
        "context":{"language":"english","country_code":"US"},"data_request":{"include_assets":true}});
    let response = client()
        .get(format!(
            "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json={}",
            urlencoding::encode(&input.to_string())
        ))
        .send()
        .await;
    let Ok(response) = response else {
        return Default::default();
    };
    let Ok(response) = response.error_for_status() else {
        return Default::default();
    };
    let Ok(data) = response.json::<Value>().await else {
        return Default::default();
    };
    data.pointer("/response/store_items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = u32::try_from(item["appid"].as_u64()?).ok()?;
                    Some((id, steam_asset_url(item)?))
                })
                .collect()
        })
        .unwrap_or_default()
}

pub(super) async fn fetch_steam_cover(name: &str) -> Option<String> {
    let response = client()
        .get(format!(
            "https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=US",
            urlencoding::encode(&catalog_title(name).replace('_', " "))
        ))
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .json::<Value>()
        .await
        .ok()?;
    let mut candidates: Vec<_> = response["items"]
        .as_array()?
        .iter()
        .filter_map(|game| {
            let score = title_score(name, game["name"].as_str()?);
            if score == 0 {
                return None;
            }
            Some((score, u32::try_from(game["id"].as_u64()?).ok()?))
        })
        .collect();
    candidates.sort_by_key(|(score, _)| std::cmp::Reverse(*score));
    let ids: Vec<_> = candidates.iter().take(3).map(|(_, id)| *id).collect();
    let assets = fetch_steam_assets(&ids).await;
    ids.iter().find_map(|id| assets.get(id).cloned())
}

pub(super) async fn fetch_epic_cover(name: &str) -> Option<String> {
    // serde_json quotes user-supplied titles safely inside the GraphQL query.
    let query = format!("query {{ Catalog {{ searchStore(keywords:{}, country:\"US\", locale:\"en-US\", count:10) {{ elements {{ title keyImages {{ type url }} }} }} }} }}", json!(catalog_title(name).replace('_', " ")));
    let response = client()
        .get(format!(
            "https://store.epicgames.com/graphql?query={}",
            urlencoding::encode(&query)
        ))
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .json::<Value>()
        .await
        .ok()?;
    epic_cover(name, &response)
}

pub(super) async fn fetch_gog_cover(name: &str) -> Option<String> {
    let query = format!("like:{}", catalog_title(name).replace('_', " "));
    let response = client()
        .get(format!("https://catalog.gog.com/v1/catalog?query={}&limit=10&productType=in%3Agame%2Cpack&countryCode=US&locale=en-US&currencyCode=USD", urlencoding::encode(&query)))
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .json::<Value>()
        .await
        .ok()?;
    gog_cover(name, &response)
}

pub(super) async fn fetch_cover(name: &str) -> Option<String> {
    // Bound total fallback time by searching both catalogs concurrently.
    let epic_name = name.to_string();
    let epic_task = tokio::spawn(async move { fetch_epic_cover(&epic_name).await });
    let gog = fetch_gog_cover(name).await;
    epic_task.await.ok().flatten().or(gog)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn original_release_year_alias_matches_the_correct_god_of_war() {
        for name in ["God of War (2018)", "God of War 2018", "God_of_War_(2018)"] {
            assert_eq!(catalog_title(name), "God of War");
            assert_eq!(title_score(name, "God of War"), 100);
            assert_eq!(title_score(name, "God of War Ragnarök"), 0);
            assert_eq!(title_score(name, "God of War (2005)"), 0);
        }
        assert_eq!(catalog_title("God of War (2005)"), "God of War (2005)");
        assert_eq!(catalog_title("F1 2018"), "F1 2018");
        assert_eq!(title_score("God of War (2018)", "God of War Soundtrack"), 0);
    }
    #[test]
    fn steam_uses_current_hashed_library_filenames() {
        let item = json!({"success":1,"appid":331160,"assets":{"asset_url_format":"steam/apps/331160/${FILENAME}?t=1", "library_capsule":"hash/library_600x900.jpg"}});
        assert_eq!(steam_asset_url(&item).as_deref(), Some("https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/331160/hash/library_600x900.jpg?t=1"));
        assert!(steam_asset_url(&json!({"success":1,"appid":331160,"assets":{}})).is_none());
    }
    #[test]
    fn title_matching_ignores_punctuation_but_rejects_sequels_and_dlcs() {
        assert_eq!(
            title_score(
                "Marvels Spider-Man Remastered",
                "Marvel’s Spider-Man Remastered™"
            ),
            100
        );
        assert_eq!(title_score("Cyberpunk_2077", "Cyberpunk 2077"), 100);
        assert_eq!(title_score("Cars", "Disney•Pixar Cars"), 95);
        assert_eq!(title_score("FC 26", "EA SPORTS FC™ 26"), 95);
        assert_eq!(title_score("Cars", "Disney•Pixar Cars 2"), 0);
        assert_eq!(title_score("Cars", "Used Cars Simulator"), 0);
        assert_eq!(title_score("Control", "Control Ultimate Edition"), 90);
        for title in [
            "Control 2",
            "Control Demo",
            "Control Soundtrack",
            "Another Game",
        ] {
            assert_eq!(title_score("Control", title), 0);
        }
    }
    #[test]
    fn epic_selects_portrait_for_the_matching_game() {
        let response = json!({"data":{"Catalog":{"searchStore":{"elements":[
            {"title":"Other Game","keyImages":[{"type":"OfferImageTall","url":"https://cdn.test/wrong.jpg"}]},
            {"title":"Control","keyImages":[{"type":"OfferImageWide","url":"https://cdn.test/wide.jpg"},
                {"type":"OfferImageTall","url":"https://cdn.test/right.jpg"}]}
        ]}}}});
        assert_eq!(
            epic_cover("Control", &response).as_deref(),
            Some("https://cdn.test/right.jpg")
        );
        assert!(epic_cover("Missing Game", &response).is_none());
        assert!(epic_cover("Control", &json!({"errors":[]})).is_none());
    }
    #[test]
    fn gog_prefers_exact_title_over_an_edition_and_handles_missing_images() {
        let response = json!({"products":[
            {"title":"Cyberpunk 2077: Ultimate Edition","coverVertical":"https://cdn.test/edition.jpg"},
            {"title":"Cyberpunk 2077","coverVertical":"https://cdn.test/base.jpg"},
            {"title":"Missing Image"}
        ]});
        assert_eq!(
            gog_cover("Cyberpunk 2077", &response).as_deref(),
            Some("https://cdn.test/base.jpg")
        );
        assert!(gog_cover("Missing Image", &response).is_none());
        assert!(gog_cover("Unknown", &json!({})).is_none());
    }
}
