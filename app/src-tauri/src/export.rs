//! Reads an Instagram data export (ZIP files or an unpacked folder, also split
//! into several parts) and turns the post JSON files into a flat post list.

use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;

/// Folders an export path is made relative to, so `media/posts/123.jpg` from the
/// JSON matches regardless of how the export was unpacked or split.
const ROOTS: [&str; 3] = ["your_instagram_activity/", "media/", "content/"];

/// (source id, file name, key that holds the list; None = top-level array)
const LISTS: [(&str, &str, Option<&str>); 4] = [
    ("posts", "posts_", None),
    ("archived", "archived_posts.json", Some("ig_archived_post_media")),
    ("reels", "reels.json", Some("ig_reels_media")),
    ("igtv", "igtv_videos.json", Some("ig_igtv_media")),
];

enum Source {
    Dir,
    Zip(Mutex<zip::ZipArchive<File>>),
}

enum Location {
    File(PathBuf),
    Entry(usize, String),
}

#[derive(Serialize, Clone)]
pub struct Media {
    pub uri: String,
    pub video: bool,
}

#[derive(Serialize, Clone)]
pub struct Post {
    pub key: String,
    pub source: String,
    pub timestamp: i64,
    pub caption: String,
    pub media: Vec<Media>,
    pub missing: usize,
}

pub struct Export {
    pub name: String,
    pub posts: Vec<Post>,
    sources: Vec<Source>,
    index: HashMap<String, (usize, Location)>,
}

#[derive(Debug)]
pub enum OpenError {
    HtmlFormat,
    NoPosts,
    Io(String),
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenError::HtmlFormat => write!(f, "html_format"),
            OpenError::NoPosts => write!(f, "no_posts"),
            OpenError::Io(e) => write!(f, "{e}"),
        }
    }
}

fn normalize(path: &str) -> Option<String> {
    let path = path.replace('\\', "/");
    if path.ends_with('/') {
        return None;
    }
    let mut start = 0;
    loop {
        let rest = &path[start..];
        if ROOTS.iter().any(|r| rest.starts_with(r)) {
            return Some(rest.to_string());
        }
        start += rest.find('/')? + 1;
    }
}

/// Instagram writes UTF-8 bytes as latin-1 code points ("Iâ\u{80}\u{99}m").
pub fn fix_text(s: &str) -> String {
    if s.chars().all(|c| (c as u32) < 256) {
        let bytes: Vec<u8> = s.chars().map(|c| c as u8).collect();
        if let Ok(fixed) = String::from_utf8(bytes) {
            return fixed;
        }
    }
    s.to_string()
}

pub fn is_video(uri: &str) -> bool {
    let lower = uri.to_ascii_lowercase();
    lower.ends_with(".mp4") || lower.ends_with(".mov")
}

pub fn mime_for(uri: &str) -> &'static str {
    match uri.rsplit('.').next().map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("heic") => "image/heic",
        Some("mp4") => "video/mp4",
        Some("mov") => "video/quicktime",
        _ => "application/octet-stream",
    }
}

fn walk(dir: &Path, out: &mut Vec<PathBuf>) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let path = entry?.path();
        if path.is_dir() {
            walk(&path, out)?;
        } else {
            out.push(path);
        }
    }
    Ok(())
}

impl Export {
    pub fn open(paths: &[PathBuf]) -> Result<Export, OpenError> {
        let mut sources = Vec::new();
        let mut index = HashMap::new();
        for path in paths {
            let id = sources.len();
            if path.is_dir() {
                let mut files = Vec::new();
                walk(path, &mut files).map_err(|e| OpenError::Io(e.to_string()))?;
                for file in files {
                    let rel = file.strip_prefix(path).unwrap_or(&file).to_string_lossy().to_string();
                    if let Some(key) = normalize(&rel) {
                        index.entry(key).or_insert((id, Location::File(file)));
                    }
                }
                sources.push(Source::Dir);
            } else {
                let file = File::open(path).map_err(|e| OpenError::Io(format!("{}: {e}", path.display())))?;
                let archive = zip::ZipArchive::new(file).map_err(|e| OpenError::Io(format!("{}: {e}", path.display())))?;
                for name in archive.file_names().flatten() {
                    if let Some(key) = normalize(&name) {
                        index.entry(key).or_insert((id, Location::Entry(id, name.to_string())));
                    }
                }
                sources.push(Source::Zip(Mutex::new(archive)));
            }
        }

        let name = paths
            .first()
            .and_then(|p| p.file_stem())
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let mut export = Export { name, posts: Vec::new(), sources, index };
        export.posts = export.parse_posts()?;
        Ok(export)
    }

    fn parse_posts(&self) -> Result<Vec<Post>, OpenError> {
        let mut json_files: Vec<(&str, &str, Option<&str>)> = Vec::new();
        let mut keys: Vec<&String> = self.index.keys().collect();
        keys.sort();
        let mut saw_html = false;
        for key in &keys {
            let file = key.rsplit('/').next().unwrap_or(key);
            for (source, prefix, list_key) in LISTS {
                let matches = if prefix.ends_with('_') {
                    file.starts_with(prefix) && file.ends_with(".json") && file[prefix.len()..file.len() - 5].parse::<u32>().is_ok()
                } else {
                    file == prefix
                };
                if matches {
                    json_files.push((source, key.as_str(), list_key));
                }
                if file.starts_with("posts_") && file.ends_with(".html") {
                    saw_html = true;
                }
            }
        }
        if json_files.is_empty() {
            return Err(if saw_html { OpenError::HtmlFormat } else { OpenError::NoPosts });
        }

        let mut posts: HashMap<String, Post> = HashMap::new();
        for (source, key, list_key) in json_files {
            let bytes = self.read(key).map_err(OpenError::Io)?;
            let value: Value = serde_json::from_slice(&bytes).map_err(|e| OpenError::Io(format!("{key}: {e}")))?;
            let list = match list_key {
                Some(k) => value.get(k).cloned().unwrap_or(Value::Null),
                None => value,
            };
            for item in list.as_array().into_iter().flatten() {
                let Some(media) = item.get("media").and_then(Value::as_array).filter(|m| !m.is_empty()) else {
                    continue;
                };
                let first = &media[0];
                let str_of = |v: &Value| v.get("title").and_then(Value::as_str).filter(|s| !s.is_empty()).map(str::to_string);
                // single-media posts keep their caption on the media entry
                let caption = str_of(item).or_else(|| str_of(first)).unwrap_or_default();
                let timestamp = item
                    .get("creation_timestamp")
                    .or_else(|| first.get("creation_timestamp"))
                    .and_then(Value::as_i64)
                    .unwrap_or(0);
                let media: Vec<Media> = media
                    .iter()
                    .filter_map(|m| m.get("uri").and_then(Value::as_str))
                    .map(|uri| Media { uri: uri.to_string(), video: is_video(uri) })
                    .collect();
                let Some(first_uri) = media.first().map(|m| m.uri.clone()) else { continue };
                let missing = media.iter().filter(|m| !self.index.contains_key(&m.uri)).count();
                posts.entry(first_uri.clone()).or_insert(Post {
                    key: first_uri,
                    source: source.to_string(),
                    timestamp,
                    caption: fix_text(&caption).trim().to_string(),
                    media,
                    missing,
                });
            }
        }
        if posts.is_empty() {
            return Err(OpenError::NoPosts);
        }
        let mut posts: Vec<Post> = posts.into_values().collect();
        posts.sort_by_key(|p| p.timestamp);
        Ok(posts)
    }

    pub fn read(&self, uri: &str) -> Result<Vec<u8>, String> {
        let (_, location) = self.index.get(uri).ok_or_else(|| format!("{uri}: not found in export"))?;
        match location {
            Location::File(path) => std::fs::read(path).map_err(|e| format!("{uri}: {e}")),
            Location::Entry(id, name) => {
                let Source::Zip(archive) = &self.sources[*id] else { unreachable!() };
                let mut archive = archive.lock().unwrap();
                let mut entry = archive.by_name(name).map_err(|e| format!("{uri}: {e}"))?;
                let mut buf = Vec::with_capacity(entry.size() as usize);
                entry.read_to_end(&mut buf).map_err(|e| format!("{uri}: {e}"))?;
                Ok(buf)
            }
        }
    }

    pub fn size(&self, uri: &str) -> Option<u64> {
        match &self.index.get(uri)?.1 {
            Location::File(path) => std::fs::metadata(path).ok().map(|m| m.len()),
            Location::Entry(id, name) => {
                let Source::Zip(archive) = &self.sources[*id] else { return None };
                let mut archive = archive.lock().unwrap();
                let size = archive.by_name(name).ok()?.size();
                Some(size)
            }
        }
    }

    pub fn post(&self, key: &str) -> Option<&Post> {
        self.posts.iter().find(|p| p.key == key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_paths() {
        assert_eq!(normalize("media/posts/1.jpg").as_deref(), Some("media/posts/1.jpg"));
        assert_eq!(normalize("instagram-x/media/posts/1.jpg").as_deref(), Some("media/posts/1.jpg"));
        assert_eq!(
            normalize("a\\your_instagram_activity\\media\\posts_1.json").as_deref(),
            Some("your_instagram_activity/media/posts_1.json")
        );
        assert_eq!(normalize("connections/x.json"), None);
    }

    #[test]
    fn fixes_mojibake() {
        assert_eq!(fix_text("I\u{e2}\u{80}\u{99}m"), "I\u{2019}m");
        assert_eq!(fix_text("schön 🐻"), "schön 🐻");
    }

    #[test]
    fn reads_real_export() {
        let Ok(dir) = std::env::var("IG_EXPORT") else { return };
        let export = Export::open(&[PathBuf::from(dir)]).unwrap();
        assert!(!export.posts.is_empty());
        assert!(export.posts.iter().all(|p| p.missing == 0));
        let first = &export.posts[0];
        assert!(!export.read(&first.media[0].uri).unwrap().is_empty());
        println!("{} posts", export.posts.len());
    }
}
