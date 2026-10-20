mod export;
mod importer;
mod pixelfed;
mod store;

use std::collections::HashMap;
use std::io::Cursor;
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};

use serde::Serialize;
use serde_json::Value;
use tauri::http::Response;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::sync::Notify;

use export::{Export, Post};
use importer::{Control, Job, Options};
use pixelfed::{Account, Limits, Pixelfed};
use store::{Imported, Store};

struct Session {
    instance: String,
    token: String,
    account: Account,
    limits: Limits,
}

struct AppState {
    store: Arc<Store>,
    session: Mutex<Option<Arc<Session>>>,
    export: Mutex<Option<Arc<Export>>>,
    thumbs: Mutex<HashMap<String, Vec<u8>>>,
    ctl: Arc<Control>,
    login_cancel: Arc<Notify>,
}

#[derive(Serialize)]
struct SessionInfo {
    instance: String,
    account: Account,
    limits: Limits,
}

#[derive(Serialize)]
struct Boot {
    session: Option<SessionInfo>,
    session_error: Option<String>,
    lang: Option<String>,
    last_exports: Vec<String>,
    options: Value,
    running: bool,
}

#[derive(Serialize)]
struct ExportInfo {
    name: String,
    paths: Vec<String>,
    posts: Vec<Post>,
    imported: HashMap<String, Imported>,
}

fn info(s: &Session) -> SessionInfo {
    SessionInfo { instance: s.instance.clone(), account: s.account.clone(), limits: s.limits.clone() }
}

fn session(state: &AppState) -> Result<Arc<Session>, String> {
    state.session.lock().unwrap().clone().ok_or_else(|| "not_logged_in".to_string())
}

async fn connect(state: &AppState, instance: String, token: String) -> Result<SessionInfo, String> {
    let client = Pixelfed::new(&instance, &token);
    let account = client.verify().await.map_err(|e| if e.auth { "auth".to_string() } else { e.message })?;
    let limits = client.limits().await;
    let s = Session { instance: instance.clone(), token: token.clone(), account, limits };
    let out = info(&s);
    *state.session.lock().unwrap() = Some(Arc::new(s));
    state.store.update_settings(|st| {
        st.instance = Some(instance);
        st.token = Some(token);
    })?;
    Ok(out)
}

#[tauri::command]
async fn boot(state: State<'_, AppState>) -> Result<Boot, String> {
    let settings = state.store.settings();
    let (mut session, mut session_error) = (None, None);
    if let Some(s) = state.session.lock().unwrap().as_ref() {
        session = Some(info(s));
    }
    if session.is_none() {
        if let (Some(instance), Some(token)) = (settings.instance.clone(), settings.token.clone()) {
            match connect(&state, instance, token).await {
                Ok(s) => session = Some(s),
                Err(e) => session_error = Some(e),
            }
        }
    }
    Ok(Boot {
        session,
        session_error,
        lang: settings.lang,
        last_exports: settings.last_exports.into_iter().filter(|p| PathBuf::from(p).exists()).collect(),
        options: settings.options,
        running: state.ctl.running.load(Ordering::SeqCst),
    })
}

#[tauri::command]
async fn login_oauth(app: AppHandle, state: State<'_, AppState>, instance: String) -> Result<SessionInfo, String> {
    let instance = pixelfed::normalize_instance(&instance);
    let opener = app.clone();
    let token = pixelfed::oauth_login(
        &instance,
        move |url| opener.opener().open_url(url, None::<&str>).map_err(|e| e.to_string()),
        state.login_cancel.clone(),
    )
    .await?;
    connect(&state, instance, token).await
}

#[tauri::command]
fn cancel_login(state: State<'_, AppState>) {
    state.login_cancel.notify_waiters();
}

#[tauri::command]
async fn login_token(state: State<'_, AppState>, instance: String, token: String) -> Result<SessionInfo, String> {
    connect(&state, pixelfed::normalize_instance(&instance), token.trim().to_string()).await
}

#[tauri::command]
fn logout(state: State<'_, AppState>) -> Result<(), String> {
    if state.ctl.running.load(Ordering::SeqCst) {
        return Err("running".into());
    }
    *state.session.lock().unwrap() = None;
    state.store.update_settings(|s| s.token = None)?;
    Ok(())
}

#[tauri::command]
fn save_prefs(state: State<'_, AppState>, lang: Option<String>, options: Option<Value>) -> Result<(), String> {
    state.store.update_settings(|s| {
        if lang.is_some() {
            s.lang = lang;
        }
        if let Some(o) = options {
            s.options = o;
        }
    })?;
    Ok(())
}

fn imported_for(state: &AppState) -> HashMap<String, Imported> {
    match state.session.lock().unwrap().as_ref() {
        Some(s) => state.store.imported(&s.instance, &s.account.id),
        None => HashMap::new(),
    }
}

#[tauri::command]
async fn open_export(state: State<'_, AppState>, paths: Vec<String>) -> Result<ExportInfo, String> {
    if state.ctl.running.load(Ordering::SeqCst) {
        return Err("running".into());
    }
    let bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();
    let export = tauri::async_runtime::spawn_blocking(move || Export::open(&bufs))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())?;
    let export = Arc::new(export);
    *state.export.lock().unwrap() = Some(export.clone());
    state.thumbs.lock().unwrap().clear();
    state.store.update_settings(|s| s.last_exports = paths.clone())?;
    Ok(ExportInfo { name: export.name.clone(), paths, posts: export.posts.clone(), imported: imported_for(&state) })
}

#[tauri::command]
fn imported(state: State<'_, AppState>) -> HashMap<String, Imported> {
    imported_for(&state)
}

#[tauri::command]
fn forget_imported(state: State<'_, AppState>, keys: Vec<String>) -> Result<HashMap<String, Imported>, String> {
    let s = session(&state)?;
    let mut map = state.store.imported(&s.instance, &s.account.id);
    for k in keys {
        map.remove(&k);
    }
    state.store.save_imported(&s.instance, &s.account.id, &map)?;
    Ok(map)
}

#[tauri::command]
fn start_import(app: AppHandle, state: State<'_, AppState>, keys: Vec<String>, options: Options) -> Result<(), String> {
    let s = session(&state)?;
    let export = state.export.lock().unwrap().clone().ok_or("no_export")?;
    if state.ctl.running.swap(true, Ordering::SeqCst) {
        return Err("running".into());
    }
    state.ctl.paused.store(false, Ordering::SeqCst);
    state.ctl.stop.store(false, Ordering::SeqCst);
    let mut keys = keys;
    keys.sort_by_key(|k| export.post(k).map(|p| p.timestamp).unwrap_or(0));
    let job = Job {
        app,
        client: Pixelfed::new(&s.instance, &s.token),
        account_id: s.account.id.clone(),
        limits: s.limits.clone(),
        store: state.store.clone(),
        ctl: state.ctl.clone(),
        export,
        keys,
        options,
    };
    tauri::async_runtime::spawn(job.run());
    Ok(())
}

#[tauri::command]
fn pause_import(state: State<'_, AppState>, paused: bool) {
    state.ctl.paused.store(paused, Ordering::SeqCst);
}

#[tauri::command]
fn stop_import(state: State<'_, AppState>) {
    state.ctl.stop.store(true, Ordering::SeqCst);
}

#[tauri::command]
fn open_url(app: AppHandle, url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("invalid url".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Small JPEG preview for an image of the open export, cached in memory.
fn thumbnail(state: &AppState, uri: &str) -> Option<Vec<u8>> {
    if let Some(t) = state.thumbs.lock().unwrap().get(uri) {
        return Some(t.clone());
    }
    let export = state.export.lock().unwrap().clone()?;
    let bytes = export.read(uri).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.thumbnail(480, 480).to_rgb8();
    let mut out = Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Jpeg).ok()?;
    let out = out.into_inner();
    state.thumbs.lock().unwrap().insert(uri.to_string(), out.clone());
    Some(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .register_asynchronous_uri_scheme_protocol("igmedia", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request.uri().path().trim_start_matches('/').to_string();
            tauri::async_runtime::spawn_blocking(move || {
                let uri = percent_encoding::percent_decode_str(&path).decode_utf8_lossy().to_string();
                let state = app.state::<AppState>();
                let resp = match thumbnail(&state, &uri) {
                    Some(bytes) => Response::builder()
                        .header("Content-Type", "image/jpeg")
                        .header("Cache-Control", "max-age=86400")
                        .body(bytes),
                    None => Response::builder().status(404).body(Vec::new()),
                };
                responder.respond(resp.unwrap());
            });
        })
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            app.manage(AppState {
                store: Arc::new(Store::new(dir)),
                session: Mutex::new(None),
                export: Mutex::new(None),
                thumbs: Mutex::new(HashMap::new()),
                ctl: Arc::new(Control::default()),
                login_cancel: Arc::new(Notify::new()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            boot,
            login_oauth,
            cancel_login,
            login_token,
            logout,
            save_prefs,
            open_export,
            imported,
            forget_imported,
            start_import,
            pause_import,
            stop_import,
            open_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
