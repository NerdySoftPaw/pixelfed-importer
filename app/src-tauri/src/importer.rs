//! The import loop: uploads media, creates posts, reports progress as events
//! and can be paused or stopped between steps.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use chrono::{Local, TimeZone};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::export::{mime_for, Export, Post};
use crate::pixelfed::{ApiError, Limits, Pixelfed};
use crate::store::{Imported, Store};

pub const EVENT: &str = "import-progress";
const MAX_RETRIES: u32 = 6;

#[derive(Deserialize, Clone)]
pub struct Options {
    pub visibility: String,
    pub sensitive: bool,
    /// caption footer, `{date}` is replaced; empty = none
    pub footer: String,
    pub lang: String,
    pub delay: u64,
}

#[derive(Serialize, Clone, Default)]
pub struct Progress {
    pub kind: &'static str,
    pub index: usize,
    pub total: usize,
    pub key: String,
    pub step: String,
    pub urls: Vec<String>,
    pub error: String,
    pub wait: u64,
    pub ok: usize,
    pub failed: usize,
}

#[derive(Default)]
pub struct Control {
    pub running: AtomicBool,
    pub paused: AtomicBool,
    pub stop: AtomicBool,
}

struct Stopped;

pub struct Job {
    pub app: AppHandle,
    pub export: Arc<Export>,
    pub client: Pixelfed,
    pub account_id: String,
    pub limits: Limits,
    pub store: Arc<Store>,
    pub ctl: Arc<Control>,
    pub keys: Vec<String>,
    pub options: Options,
}

pub fn caption(text: &str, ts: i64, limit: usize, part: &str, footer: &str, lang: &str) -> String {
    let date = Local
        .timestamp_opt(ts, 0)
        .single()
        .map(|d| d.format(if lang == "de" { "%d.%m.%Y" } else { "%Y-%m-%d" }).to_string())
        .unwrap_or_default();
    let mut tail = String::new();
    if !part.is_empty() {
        tail.push(' ');
        tail.push_str(part);
    }
    if !footer.trim().is_empty() {
        tail.push_str("\n\n");
        tail.push_str(&footer.replace("{date}", &date));
    }
    let room = limit.saturating_sub(tail.chars().count());
    let body: String = if text.chars().count() > room {
        let cut: String = text.chars().take(room.saturating_sub(1)).collect();
        format!("{}…", cut.trim_end())
    } else {
        text.to_string()
    };
    format!("{body}{tail}").trim().to_string()
}

impl Job {
    fn emit(&self, p: Progress) {
        let _ = self.app.emit(EVENT, p);
    }

    /// Sleeps in small steps so pause/stop react immediately; blocks while paused.
    async fn wait(&self, secs: u64) -> Result<(), Stopped> {
        let mut left = secs * 4;
        loop {
            if self.ctl.stop.load(Ordering::SeqCst) {
                return Err(Stopped);
            }
            if left == 0 && !self.ctl.paused.load(Ordering::SeqCst) {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
            if !self.ctl.paused.load(Ordering::SeqCst) {
                left = left.saturating_sub(1);
            }
        }
    }

    async fn with_retry<T, F, Fut>(&self, base: &Progress, mut f: F) -> Result<Result<T, ApiError>, Stopped>
    where
        F: FnMut() -> Fut,
        Fut: std::future::Future<Output = Result<T, ApiError>>,
    {
        let mut attempt = 0;
        loop {
            match f().await {
                Err(e) if e.retry_after.is_some() && attempt < MAX_RETRIES => {
                    attempt += 1;
                    let wait = e.retry_after.unwrap().clamp(5, 900) * attempt as u64;
                    self.emit(Progress { kind: "waiting", wait, error: e.message.clone(), ..base.clone() });
                    self.wait(wait).await?;
                }
                other => return Ok(other),
            }
        }
    }

    /// Returns Err(Stopped) if the user stopped; inner Err = this post failed.
    async fn import_post(&self, post: &Post, base: &Progress) -> Result<Result<Imported, (String, Imported, bool)>, Stopped> {
        let mut skipped = Vec::new();
        let mut files = Vec::new();
        for m in &post.media {
            let mime = mime_for(&m.uri);
            let limit = if m.video { self.limits.video_size } else { self.limits.image_size };
            if !self.limits.mime_types.iter().any(|t| t == mime) {
                skipped.push(format!("{} ({mime})", m.uri.rsplit('/').next().unwrap_or(&m.uri)));
            } else if self.export.size(&m.uri).is_some_and(|s| s > limit) {
                skipped.push(format!("{} (> {} MB)", m.uri.rsplit('/').next().unwrap_or(&m.uri), limit / 1_000_000));
            } else {
                files.push(m);
            }
        }
        let mut done = Imported { at: Local::now().timestamp(), ..Default::default() };
        if files.is_empty() {
            return Ok(Err((format!("unsupported: {}", skipped.join(", ")), done, false)));
        }

        let chunks: Vec<_> = files.chunks(self.limits.max_media.max(1)).collect();
        let total_files = files.len();
        let mut uploaded = 0;
        for (n, chunk) in chunks.iter().enumerate() {
            let part = if chunks.len() > 1 { format!("({}/{})", n + 1, chunks.len()) } else { String::new() };
            let text = if n == 0 { post.caption.as_str() } else { "" };
            let text = caption(text, post.timestamp, self.limits.max_chars, &part, &self.options.footer, &self.options.lang);

            let mut media_ids = Vec::new();
            for m in chunk.iter() {
                uploaded += 1;
                self.emit(Progress { kind: "step", step: format!("upload {uploaded}/{total_files}"), ..base.clone() });
                let export = self.export.clone();
                let uri = m.uri.clone();
                let bytes = match tauri::async_runtime::spawn_blocking(move || export.read(&uri)).await {
                    Ok(Ok(b)) => b,
                    Ok(Err(e)) => return Ok(Err((e, done, false))),
                    Err(e) => return Ok(Err((e.to_string(), done, false))),
                };
                let name = m.uri.rsplit('/').next().unwrap_or("file").to_string();
                let mime = mime_for(&m.uri);
                match self.with_retry(base, || self.client.upload(bytes.clone(), &name, mime)).await? {
                    Ok(id) => media_ids.push(id),
                    Err(e) => return Ok(Err((e.message, done, e.auth))),
                }
            }
            self.emit(Progress { kind: "step", step: "post".into(), ..base.clone() });
            let visibility = self.options.visibility.clone();
            match self.with_retry(base, || self.client.post(&text, &media_ids, &visibility, self.options.sensitive)).await? {
                Ok((id, url)) => {
                    done.ids.push(id);
                    done.urls.push(url);
                }
                Err(e) => {
                    done.partial = !done.ids.is_empty();
                    return Ok(Err((e.message, done, e.auth)));
                }
            }
            if n + 1 < chunks.len() {
                self.wait(self.options.delay.min(5)).await?;
            }
        }
        done.skipped = skipped;
        Ok(Ok(done))
    }

    pub async fn run(self) {
        let total = self.keys.len();
        let (mut ok, mut failed) = (0, 0);
        let mut imported = self.store.imported(&self.client.base, &self.account_id);
        self.emit(Progress { kind: "start", total, ..Default::default() });

        for (i, key) in self.keys.iter().enumerate() {
            let base = Progress { index: i + 1, total, key: key.clone(), ok, failed, ..Default::default() };
            if self.wait(0).await.is_err() {
                break;
            }
            let Some(post) = self.export.post(key) else { continue };
            // partially posted albums count as done too, retrying would duplicate them
            if imported.contains_key(key) {
                ok += 1;
                continue;
            }
            self.emit(Progress { kind: "begin", ..base.clone() });
            let result = match self.import_post(post, &base).await {
                Ok(r) => r,
                Err(Stopped) => break,
            };
            match result {
                Ok(entry) => {
                    ok += 1;
                    let urls = entry.urls.clone();
                    imported.insert(key.clone(), entry);
                    let _ = self.store.save_imported(&self.client.base, &self.account_id, &imported);
                    self.emit(Progress { kind: "post", urls, ok, failed, ..base.clone() });
                }
                Err((error, entry, auth)) => {
                    failed += 1;
                    if !entry.ids.is_empty() {
                        imported.insert(key.clone(), entry.clone());
                        let _ = self.store.save_imported(&self.client.base, &self.account_id, &imported);
                    }
                    self.emit(Progress { kind: "failed", error, urls: entry.urls, ok, failed, ..base.clone() });
                    if auth {
                        self.emit(Progress { kind: "fatal", error: "auth".into(), ok, failed, ..base.clone() });
                        break;
                    }
                }
            }
            if i + 1 < total && self.wait(self.options.delay).await.is_err() {
                break;
            }
        }
        let stopped = self.ctl.stop.load(Ordering::SeqCst);
        self.ctl.running.store(false, Ordering::SeqCst);
        self.emit(Progress { kind: if stopped { "stopped" } else { "done" }, total, ok, failed, ..Default::default() });
    }
}

#[cfg(test)]
mod tests {
    use super::caption;

    #[test]
    fn caption_limits() {
        let c = caption(&"x".repeat(600), 0, 500, "(1/2)", "from IG {date}", "en");
        assert_eq!(c.chars().count(), 500);
        assert!(c.contains("… (1/2)\n\nfrom IG 1970-01-01"));
        assert_eq!(caption("", 0, 500, "", "", "en"), "");
        assert_eq!(caption("hi", 0, 500, "", "", "en"), "hi");
    }
}
