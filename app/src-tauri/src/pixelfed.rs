//! Minimal client for the Mastodon-compatible Pixelfed API.

use std::time::Duration;

use reqwest::{multipart, Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const SCOPES: &str = "read write";
const APP_NAME: &str = "Pixelfed Importer";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Limits {
    pub max_chars: usize,
    pub max_media: usize,
    pub image_size: u64,
    pub video_size: u64,
    pub mime_types: Vec<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct Account {
    pub id: String,
    pub acct: String,
    pub display_name: String,
    pub avatar: String,
    pub url: String,
}

/// Error from the API. `retry` = transient (rate limit / server), `auth` = token invalid.
#[derive(Debug)]
pub struct ApiError {
    pub message: String,
    pub retry_after: Option<u64>,
    pub auth: bool,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

impl From<reqwest::Error> for ApiError {
    fn from(e: reqwest::Error) -> Self {
        // network hiccups are worth a retry
        ApiError { message: e.to_string(), retry_after: Some(15), auth: false }
    }
}

pub fn normalize_instance(input: &str) -> String {
    let s = input.trim().trim_end_matches('/');
    let s = s.strip_prefix('@').unwrap_or(s);
    // "user@instance.tld" → instance
    let s = match s.rsplit_once('@') {
        Some((_, host)) if !s.contains("://") => host,
        _ => s,
    };
    if s.starts_with("http://") || s.starts_with("https://") {
        s.to_string()
    } else {
        format!("https://{s}")
    }
}

fn http() -> Client {
    Client::builder()
        .user_agent(concat!("PixelfedImporter/", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(600))
        .build()
        .expect("http client")
}

async fn check(resp: reqwest::Response) -> Result<Value, ApiError> {
    let status = resp.status();
    if status.is_success() {
        return Ok(resp.json().await.unwrap_or(Value::Null));
    }
    let retry_after = resp
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok());
    let body = resp.text().await.unwrap_or_default();
    let detail = serde_json::from_str::<Value>(&body)
        .ok()
        .and_then(|v| v.get("error").or_else(|| v.get("message")).and_then(Value::as_str).map(str::to_string))
        .unwrap_or_else(|| body.chars().take(200).collect());
    let transient = status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error();
    Err(ApiError {
        message: format!("HTTP {}: {}", status.as_u16(), detail.trim()),
        retry_after: if transient { Some(retry_after.unwrap_or(60)) } else { None },
        auth: status == StatusCode::UNAUTHORIZED,
    })
}

pub struct Pixelfed {
    pub base: String,
    token: String,
    http: Client,
}

impl Pixelfed {
    pub fn new(base: &str, token: &str) -> Self {
        Pixelfed { base: base.to_string(), token: token.to_string(), http: http() }
    }

    async fn get(&self, path: &str) -> Result<Value, ApiError> {
        check(self.http.get(format!("{}{path}", self.base)).bearer_auth(&self.token).send().await?).await
    }

    pub async fn verify(&self) -> Result<Account, ApiError> {
        let v = self.get("/api/v1/accounts/verify_credentials").await?;
        let s = |k: &str| v.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
        let id = match v.get("id") {
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
            None => String::new(),
        };
        Ok(Account { id, acct: s("acct"), display_name: s("display_name"), avatar: s("avatar"), url: s("url") })
    }

    pub async fn limits(&self) -> Limits {
        let cfg = self.get("/api/v1/instance").await.ok().and_then(|v| v.get("configuration").cloned()).unwrap_or(Value::Null);
        let num = |path: &[&str], default: u64| {
            path.iter().try_fold(&cfg, |v, k| v.get(*k)).and_then(Value::as_u64).unwrap_or(default)
        };
        let mime_types = cfg
            .pointer("/media_attachments/supported_mime_types")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_else(|| vec!["image/jpeg".into(), "image/png".into()]);
        Limits {
            max_chars: num(&["statuses", "max_characters"], 500) as usize,
            max_media: num(&["statuses", "max_media_attachments"], 4) as usize,
            image_size: num(&["media_attachments", "image_size_limit"], 15_000_000),
            video_size: num(&["media_attachments", "video_size_limit"], 15_000_000),
            mime_types,
        }
    }

    pub async fn upload(&self, bytes: Vec<u8>, name: &str, mime: &str) -> Result<String, ApiError> {
        let part = multipart::Part::bytes(bytes).file_name(name.to_string()).mime_str(mime).map_err(ApiError::from)?;
        let form = multipart::Form::new().part("file", part);
        let resp = self
            .http
            .post(format!("{}/api/v1/media", self.base))
            .bearer_auth(&self.token)
            .multipart(form)
            .send()
            .await?;
        let v = check(resp).await?;
        match v.get("id") {
            Some(Value::String(s)) => Ok(s.clone()),
            Some(Value::Number(n)) => Ok(n.to_string()),
            _ => Err(ApiError { message: "upload: no media id in response".into(), retry_after: None, auth: false }),
        }
    }

    pub async fn post(&self, text: &str, media_ids: &[String], visibility: &str, sensitive: bool) -> Result<(String, String), ApiError> {
        let mut form: Vec<(&str, String)> = vec![("status", text.to_string()), ("visibility", visibility.to_string())];
        form.extend(media_ids.iter().map(|id| ("media_ids[]", id.clone())));
        if sensitive {
            form.push(("sensitive", "true".into()));
        }
        let resp = self
            .http
            .post(format!("{}/api/v1/statuses", self.base))
            .bearer_auth(&self.token)
            .form(&form)
            .send()
            .await?;
        let v = check(resp).await?;
        let id = match v.get("id") {
            Some(Value::String(s)) => s.clone(),
            Some(other) => other.to_string(),
            None => String::new(),
        };
        let url = v.get("url").and_then(Value::as_str).unwrap_or_default().to_string();
        Ok((id, url))
    }
}

/// OAuth login via the system browser and a loopback redirect.
/// `open` is called with the authorize URL; `cancel` aborts the wait.
pub async fn oauth_login(
    instance: &str,
    open: impl FnOnce(String) -> Result<(), String>,
    cancel: std::sync::Arc<tokio::sync::Notify>,
) -> Result<String, String> {
    let listener = TcpListener::bind("127.0.0.1:0").await.map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect = format!("http://127.0.0.1:{port}/callback");
    let http = http();

    let app = http
        .post(format!("{instance}/api/v1/apps"))
        .form(&[("client_name", APP_NAME), ("redirect_uris", redirect.as_str()), ("scopes", SCOPES)])
        .send()
        .await
        .map_err(|e| format!("connect: {e}"))?;
    let app = check(app).await.map_err(|e| format!("register_app: {e}"))?;
    let field = |k: &str| match app.get(k) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    };
    let (client_id, client_secret) = (field("client_id"), field("client_secret"));
    if client_id.is_empty() {
        return Err("register_app: no client id".into());
    }

    let mut url = reqwest::Url::parse(&format!("{instance}/oauth/authorize")).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("response_type", "code")
        .append_pair("scope", SCOPES);
    open(url.to_string())?;

    let code = tokio::select! {
        code = wait_for_code(&listener) => code?,
        _ = cancel.notified() => return Err("cancelled".into()),
        _ = tokio::time::sleep(Duration::from_secs(600)) => return Err("timeout".into()),
    };

    let resp = http
        .post(format!("{instance}/oauth/token"))
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect.as_str()),
            ("scope", SCOPES),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let token = check(resp).await.map_err(|e| format!("token: {e}"))?;
    token
        .get("access_token")
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "token: no access_token".into())
}

const DONE_PAGE: &str = r#"<!doctype html><meta charset="utf-8"><title>Pixelfed Importer</title>
<body style="font-family:system-ui;display:grid;place-items:center;height:90vh;background:#f6f4fb;color:#222">
<div style="text-align:center"><div style="font-size:48px">✅</div><h2>Angemeldet · Signed in</h2>
<p>Du kannst dieses Fenster schließen und zur App zurückkehren.<br>You can close this tab and return to the app.</p></div>"#;

async fn wait_for_code(listener: &TcpListener) -> Result<String, String> {
    loop {
        let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 8192];
        let n = stream.read(&mut buf).await.map_err(|e| e.to_string())?;
        let request = String::from_utf8_lossy(&buf[..n]);
        let path = request.split_whitespace().nth(1).unwrap_or("/");
        let Ok(url) = reqwest::Url::parse(&format!("http://localhost{path}")) else { continue };
        if url.path() != "/callback" {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n").await;
            continue;
        }
        let param = |k: &str| url.query_pairs().find(|(key, _)| key == k).map(|(_, v)| v.to_string());
        let body = DONE_PAGE.as_bytes();
        let header = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
        let _ = stream.write_all(header.as_bytes()).await;
        let _ = stream.write_all(body).await;
        if let Some(code) = param("code") {
            return Ok(code);
        }
        if let Some(err) = param("error") {
            return Err(format!("denied: {err}"));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_instance;

    #[test]
    fn instance_input() {
        assert_eq!(normalize_instance("pixelfed.social"), "https://pixelfed.social");
        assert_eq!(normalize_instance(" https://pixelfed.de/ "), "https://pixelfed.de");
        assert_eq!(normalize_instance("@me@pixelfed.social"), "https://pixelfed.social");
    }
}
