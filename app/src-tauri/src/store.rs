//! Settings (login, options) and the per-account list of imported posts.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Settings {
    pub instance: Option<String>,
    pub token: Option<String>,
    pub lang: Option<String>,
    #[serde(default)]
    pub last_exports: Vec<String>,
    #[serde(default)]
    pub options: Value,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Imported {
    pub ids: Vec<String>,
    pub urls: Vec<String>,
    pub at: i64,
    #[serde(default)]
    pub partial: bool,
    #[serde(default)]
    pub skipped: Vec<String>,
}

pub type ImportedMap = HashMap<String, Imported>;

fn load<T: DeserializeOwned + Default>(path: &Path) -> T {
    std::fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

/// Write atomically; the settings file holds the access token, so keep it private.
fn save<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, serde_json::to_vec_pretty(value).unwrap()).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub struct Store {
    dir: PathBuf,
}

impl Store {
    pub fn new(dir: PathBuf) -> Self {
        Store { dir }
    }

    fn settings_path(&self) -> PathBuf {
        self.dir.join("settings.json")
    }

    pub fn settings(&self) -> Settings {
        load(&self.settings_path())
    }

    pub fn update_settings(&self, f: impl FnOnce(&mut Settings)) -> Result<Settings, String> {
        let mut s = self.settings();
        f(&mut s);
        save(&self.settings_path(), &s)?;
        Ok(s)
    }

    fn imported_path(&self, instance: &str, account_id: &str) -> PathBuf {
        let host: String = instance
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '-' { c } else { '_' })
            .collect();
        self.dir.join("imported").join(format!("{host}_{account_id}.json"))
    }

    pub fn imported(&self, instance: &str, account_id: &str) -> ImportedMap {
        load(&self.imported_path(instance, account_id))
    }

    pub fn save_imported(&self, instance: &str, account_id: &str, map: &ImportedMap) -> Result<(), String> {
        save(&self.imported_path(instance, account_id), map)
    }
}
