use argon2::{password_hash::{rand_core::OsRng, SaltString}, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use axum::{
    async_trait, body::Body, extract::{DefaultBodyLimit, FromRequestParts, Multipart, State}, http::{header, request::Parts, HeaderValue, Method, Request, StatusCode, Uri}, response::{Html, IntoResponse, Response}, routing::{get, get_service, post}, Form, Json, Router
};
use chrono::{Duration, Utc};
use cookie::{time, Cookie, CookieBuilder, SameSite};
use image::{DynamicImage, imageops::FilterType, ImageFormat};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use lofty::{file::{FileType, TaggedFileExt}, probe::Probe};
use mime_guess::{from_path, get_mime_extensions_str};
use once_cell::sync::Lazy;
use percent_encoding::percent_decode_str;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{fs::File, io::{AsyncReadExt, AsyncWriteExt}, task};
use tower::service_fn;
use tower_http::{compression::CompressionLayer, cors::{AllowOrigin, CorsLayer}, services::ServeDir};
use uuid::Uuid;
use std::{convert::Infallible, env, io::Cursor, time::{SystemTime, UNIX_EPOCH}};
use rust_embed::Embed;
use std::sync::Arc;

use crate::database::{BSDatabase, LocalStorageManager, MusicTable, PlaylistEntryRow, PlaylistEntryTable, PlaylistRow, PlaylistTable, UsersTable};
use crate::log;
use crate::utils::LogLevel;

#[derive(Embed)]
#[folder = "html/"]
struct Assets;

const DEV_HTTP_DIR: &str = "/Users/crack/Bang/bandosquatter/html";

static JWT_SECRET: Lazy<String> = Lazy::new(|| {
    // If compiling in debug, you can use a fixed secret
    if cfg!(debug_assertions) {
        "devsecret".to_string()
    } else {
        // In production, read from env var
        env::var("JWT_SECRET").expect("JWT_SECRET must be set in production")
    }
});

#[derive(Deserialize)]
struct LoginParams {
    username: String,
    password: String,
}

#[derive(Deserialize)]
struct ChangePasswordParams {
    to: String
}

#[derive(Serialize, Deserialize)]
pub struct TokenClaims {
    sub: String,
    exp: usize,
}

#[derive(Clone)]
pub struct AppState {
    pub db: BSDatabase,
    pub storage: LocalStorageManager,
}

async fn embedded_service(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    if path.is_empty() || !Assets::get(path).is_some() {
        let index = Assets::get("index.html").expect("index.html not embedded");
        let mime = mime_guess::from_path("index.html").first_or_octet_stream();
        return Response::builder()
            .status(StatusCode::OK)
            .header("Content-Type", mime.as_ref())
            .body(Body::from(index.data.into_owned()))
            .unwrap();
    }

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime.as_ref())
                .body(Body::from(content.data.into_owned()))
                .unwrap()
        }
        None => (StatusCode::NOT_FOUND, Html("<h1>404</h1><p>could not load 404 page.</p>")).into_response(),
    }
}

pub fn create_app_routes() -> Router {
    if cfg!(debug_assertions) {
        let fallback_service = service_fn(|req: Request<Body>| async move {
            let uri_path = req.uri().path().trim_start_matches('/');

            let dir = match env::var("HTTP_DIR") {
                Ok(dir) => dir,
                Err(_) => DEV_HTTP_DIR.to_string(),
            };

            let file_path = format!("{}/{}", dir, uri_path);

            if tokio::fs::metadata(&file_path).await.is_ok() {
                let data = tokio::fs::read(&file_path).await.unwrap_or_default();
                let mime = mime_guess::from_path(&file_path).first_or_octet_stream();
                let res = Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", mime.as_ref())
                    .body(Body::from(data))
                    .unwrap();
                Ok::<_, Infallible>(res)
            } else {
                let index_path = format!("{}/index.html", dir);
                let html = tokio::fs::read_to_string(&index_path).await.unwrap_or_else(|_| {
                    "<h1>404</h1><p>Could not load index.html.</p>".to_string()
                });
                let res = Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(Body::from(html))
                    .unwrap();
                Ok::<_, Infallible>(res)
            }
        });

        let serve_dir = ServeDir::new(DEV_HTTP_DIR).fallback(fallback_service);

        let service = get_service(serve_dir).handle_error(|error| async move {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("unhandled internal error: {}", error),
            )
        });

        Router::new().nest_service("/", service).layer(CompressionLayer::new())
    } else {
        Router::new().fallback(|uri: Uri| async move { embedded_service(uri).await }).layer(CompressionLayer::new())
    }
}

pub struct JwtAuth(pub TokenClaims);

#[async_trait]
impl<S> FromRequestParts<S> for JwtAuth
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let cookie_header = parts.headers.get(header::COOKIE).and_then(|v| v.to_str().ok());

        let token = cookie_header
            .and_then(|c| {
                c.split(';')
                    .find_map(|pair| {
                        let mut parts = pair.trim().splitn(2, '=');
                        let key = parts.next()?;
                        let value = parts.next()?;
                        if key == "token" {
                            Some(value.to_string())
                        } else {
                            None
                        }
                    })
            })
            .ok_or((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "status": "error", "reason": "missing auth cookie" })),
            ))?;

        match decode::<TokenClaims>(
            &token,
            &DecodingKey::from_secret(JWT_SECRET.as_bytes()),
            &Validation::default(),
        ) {
            Ok(token_data) => Ok(JwtAuth(token_data.claims)),
            Err(_) => Err((
                StatusCode::UNAUTHORIZED,
                Json(json!({ "status": "error", "reason": "invalid token" })),
            )),
        }
    }
}

async fn verify_handler(
    JwtAuth(_): JwtAuth
) -> Json<serde_json::Value> {
    return Json(json!({ "status": "ok" }))
}

static DUMMY_HASH: &str = "$argon2id$v=19$m=19456,t=2,p=1$AEbD9Fw+poC6Mi5mOrIuqg$ZYamkMyrDy6f52P5J3wpFaIWDwQDfu+kQkzRHYChnQs";

async fn login_handler(
    State(state): State<Arc<AppState>>,
    Form(params): Form<LoginParams>
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user_res = UsersTable::get_by_username(&params.username, &conn);

    // get either the real hash or the dummy; still do verify in both cases
    let password_hash_str = match user_res {
        Ok(Some(user)) => user.password.clone(),
        Ok(None) | Err(_) => DUMMY_HASH.to_string() // use dummy on missing user or db error
    };

    // perform the expensive verify on a blocking thread to avoid blocking the async runtime
    let supplied_password = params.password.clone();
    let verify_result = task::spawn_blocking(move || {
        let parsed = PasswordHash::new(&password_hash_str).map_err(|_| ());
        if parsed.is_err() {
            return Err(());
        }
        let parsed = parsed.unwrap();
        let argon2 = Argon2::default();
        argon2.verify_password(supplied_password.as_bytes(), &parsed).map_err(|_| ())
    }).await;

    let ok = verify_result
        .map(|r| r.is_ok())
        .unwrap_or(false);

    if ok {
        // note: if the user didn't exist we verified a dummy hash — ok==true should only happen if the real hash matched.
        let expiration = Utc::now()
            .checked_add_signed(Duration::hours(24)) // token valid for 24h
            .expect("valid timestamp")
            .timestamp() as usize;

        // You can use the username or user ID in sub
        let claims = TokenClaims { sub: params.username.clone(), exp: expiration };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(JWT_SECRET.as_bytes())
        ).expect("JWT encode failed");

        let mut cookie = CookieBuilder::build(
            Cookie::build(("token", token))
                .path("/")
                .http_only(true)
                .secure(true)
                .same_site(SameSite::Lax)
                .max_age(time::Duration::hours(24)
            )
        );

        if cfg!(debug_assertions) {
            cookie.set_secure(false);
        }

        return (
            StatusCode::OK,
            [(header::SET_COOKIE, cookie.to_string())],
            Json(json!({ "status": "ok" })),
        ).into_response();
    } else {
        return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error", "reason": "invalid credentials" }))).into_response();
    }
}

async fn change_password_handler(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<ChangePasswordParams>
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let mut user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let password = params.to.as_bytes();
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    
    user.password = match argon2.hash_password(password, &salt) {
        Ok(pass) => pass.to_string(),
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response()
    };

    let ok = UsersTable::replace(&user, &conn);

    if ok {
        return (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response();
    } else {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response();
    }
}

async fn get_music_handler(JwtAuth(claims): JwtAuth, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let music = match MusicTable::get_by_user(user.id.unwrap(), &conn, false) {
        Ok(music) => music,
        Err(e) => {
            let msg = format!("internal error -> {}", e);

            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg}))).into_response();
        }
    };

    return (StatusCode::OK, Json(json!({ "status": "ok", "music": music }))).into_response();
}

async fn serve_music_service(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    uri: Uri,
) -> impl IntoResponse {
    let path = uri
        .path()
        .strip_prefix("/static/")
        .unwrap_or_else(|| uri.path().trim_start_matches('/'));

    let decoded_path = match percent_decode_str(path).decode_utf8() {
        Ok(p) => p,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "status": "error", "reason": "bad encoding"})),
            )
                .into_response()
        }
    };

    let full_path = state.storage.get_root_dir().join(decoded_path.as_ref());

    let mut components = path.splitn(2, '/');
    let username_in_path = match components.next() {
        Some(u) => u,
        None => return (StatusCode::BAD_REQUEST, Json(json!({ "status": "error", "reason": "bad request"}))).into_response(),
    };

    if claims.sub != username_in_path {
        return (StatusCode::FORBIDDEN, Json(json!({ "status": "error", "reason": "unauthorised"}))).into_response();
    }

    if !full_path.exists() || !full_path.is_file() {
        return (StatusCode::NOT_FOUND, Json(json!({ "status": "error", "reason": "not found"}))).into_response();
    }

    let mime_type = from_path(&full_path).first_or_octet_stream();

    match File::open(&full_path).await {
        Ok(mut f) => {
            let mut buffer = Vec::new();
            if f.read_to_end(&mut buffer).await.is_err() {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"status": "error", "reason": "internal error"})),
                )
                    .into_response();
            }

            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime_type.as_ref())
                .body(buffer.into())
                .unwrap()
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "reason": "internal error"})),
        )
            .into_response(),
    }
}

pub async fn serve_cover(
    State(state): State<Arc<AppState>>,
    uri: Uri,
) -> impl IntoResponse {
    let path = uri
        .path()
        .strip_prefix("/cover/")
        .unwrap_or_else(|| uri.path().trim_start_matches('/'));

    let decoded_path = match percent_decode_str(path).decode_utf8() {
        Ok(p) => p,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "status": "error", "reason": "bad encoding"})),
            )
                .into_response();
        }
    };

    // Split into username + rest of path
    let mut components = decoded_path.splitn(2, '/');
    let username_in_path = match components.next() {
        Some(u) => u,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "status": "error", "reason": "bad request"})),
            )
                .into_response();
        }
    };

    let file_rel = match components.next() {
        Some(f) => f,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "status": "error", "reason": "missing file"})),
            )
                .into_response();
        }
    };

    // Build full path: root_dir/username/covers/file
    let full_path = state
        .storage
        .get_root_dir()
        .join(username_in_path)
        .join(file_rel);

    if !full_path.exists() || !full_path.is_file() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "status": "error", "reason": "not found"})),
        )
            .into_response();
    }

    let mime_type = from_path(&full_path).first_or_octet_stream();

    match File::open(&full_path).await {
        Ok(mut f) => {
            let mut buffer = Vec::new();
            if f.read_to_end(&mut buffer).await.is_err() {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"status": "error", "reason": "internal error"})),
                )
                    .into_response();
            }

            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime_type.as_ref())
                .body(buffer.into())
                .unwrap()
        }
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"status": "error", "reason": "internal error"})),
        )
            .into_response(),
    }
}

async fn get_audio_extension(path: &str) -> Result<String, String> {
    let tagged_file = Probe::open(path)
        .map_err(|e| format!("failed to open file: {}", e))?
        .guess_file_type()
        .map_err(|e| format!("failed to guess file type: {}", e))?
        .read()
        .map_err(|e| format!("failed to parse tags: {}", e))?;

    let ext = match tagged_file.file_type() {
        FileType::Mpeg => "mp3",
        FileType::Flac => "flac",
        FileType::Wav => "wav",
        FileType::Opus => "opus",
        FileType::Vorbis => "ogg",
        FileType::Aiff => "aiff",
        FileType::Ape => "ape",
        FileType::Aac => "aac",
        FileType::Mp4 => "m4a",
        other => {
            return Err(format!("unsupported audio format: {:?}", other));
        }
    };

    Ok(ext.to_string())
}

async fn upload_handler(JwtAuth(claims): JwtAuth, State(state): State<Arc<AppState>>, mut multipart: Multipart) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    while let Some(field_result) = multipart.next_field().await.transpose() {
        let field = match field_result {
            Ok(f) => f,
            Err(err) => {
                log!(LogLevel::Err, "multipart error: {}", err);
                return (StatusCode::BAD_REQUEST, Json(json!({"status": "error", "reason": "invalid multipart"}))).into_response();
            }
        };

        let name = field.name().map(|n| n.to_string());
        let file_name = field.file_name().map(|n| n.to_string());

        let content_type = field.content_type().map(|m| m.to_string());
        if let Some(ref mime) = content_type {
            if !mime.starts_with("audio/") {
                return (
                    StatusCode::UNSUPPORTED_MEDIA_TYPE,
                    Json(json!({"status": "error", "reason": "only audio uploads allowed"})),
                )
                    .into_response();
            }
        } else {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"status": "error", "reason": "missing content-type"})),
            )
                .into_response();
        }

        let ext = field
            .content_type()
            .and_then(|mime| get_mime_extensions_str(mime.as_ref()))
            .and_then(|exts| exts.first().map(|ext| *ext));

        let safe_name = match ext {
            Some(e) => format!("{}.{}", Uuid::new_v4(), e),
            None => format!("{}.bin", Uuid::new_v4()),
        };

        let tmp_path = format!("{}/{}/{}", state.storage.get_root_dir().display(), claims.sub, safe_name);
        let mut file = match File::create(&tmp_path).await {
            Ok(f) => f,
            Err(err) => {
                log!(LogLevel::Err, "file error: {}", err);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"status": "error", "reason": "file save error"}))).into_response();
            }
        };

        let mut field = field;
        while let Some(chunk) = field.chunk().await.unwrap_or(None) {
            if let Err(err) = file.write_all(&chunk).await {
                let _ = std::fs::remove_file(&tmp_path);
                eprintln!("write error: {}", err);
                return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"status": "error", "reason": "write error"}))).into_response();
            }
        }

        match get_audio_extension(&tmp_path).await {
            Ok(ext) => {
                let final_name = format!("{}.{}", Uuid::new_v4(), ext);
                let final_path = format!("{}/{}/{}", state.storage.get_root_dir().display(), claims.sub, final_name);
                
                if let Err(e) = tokio::fs::rename(&tmp_path, &final_path).await {
                    let _ = tokio::fs::remove_file(&tmp_path).await;
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"status": "error", "reason": format!("rename failed: {}", e)}))
                    ).into_response();
                }

                log!(
                    LogLevel::Debug,
                    "uploaded field {:?}, original name {:?}, saved as {}",
                    name, file_name, final_name
                );

                if let Err(e) = state.storage.add_single_song(&claims.sub, &final_path, &conn) {
                    let _ = std::fs::remove_file(&final_path);
                    return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"status": "error", "reason": format!("failed to add to db err -> {}", e)})))
                        .into_response()
                };
            }
            Err(e) => {
                let _ = tokio::fs::remove_file(&tmp_path).await;
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"status": "error", "reason": format!("invalid audio file: {}", e)}))
                ).into_response();
            }
        }
    }

    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}

async fn get_playlist(JwtAuth(claims): JwtAuth, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let playlists = match PlaylistTable::get_by_username(user.id.unwrap(), &conn) {
        Ok(p) => p,
        Err(e) => {
            let msg = format!("failed to get usernames from db -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    return (StatusCode::OK, Json(json!({ "status": "ok", "playlists": playlists }))).into_response();
}

async fn new_playlist(JwtAuth(claims): JwtAuth, State(state): State<Arc<AppState>>, mut multipart: Multipart) -> impl IntoResponse {
    let mut title: Option<String> = None;
    let mut cover_bytes: Option<Vec<u8>> = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap().to_string();

        match name.as_str() {
            "title" => {
                title = Some(field.text().await.unwrap());
            }
            "picture" => {
                let bytes = field.bytes().await.unwrap();

                let img = match image::load_from_memory(&bytes) {
                    Ok(img) => img,
                    Err(_) => {
                        return (
                            StatusCode::BAD_REQUEST,
                            Json(json!({"error": "invalid image file"})),
                        )
                            .into_response();
                    }
                };

                let resized: DynamicImage =
                    img.resize_exact(512, 512, FilterType::Triangle);

                let mut buf = Vec::new();
                if resized.write_to(&mut Cursor::new(&mut buf), ImageFormat::Jpeg).is_err() {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error": "failed to encode image"})),
                    )
                        .into_response();
                }

                cover_bytes = Some(buf);
            }
            _ => {}
        }
    }

    if title.is_none() || cover_bytes.is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "missing title or picture"})),
        )
            .into_response();
    }

    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let table = PlaylistRow {
        id: None,
        userid: user.id.unwrap(),
        title: title.unwrap(),
        picture: cover_bytes.unwrap(),
        date_added: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    };

    if !PlaylistTable::insert(&table, &conn) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to insert playlist" }))).into_response()
    };

    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}

#[derive(Deserialize)]
struct PlaylistParams {
    playlist_id: i32,
}

async fn delete_playlist(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<PlaylistParams>
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let exists = match PlaylistTable::get_by_id(params.playlist_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let playlist = match exists {
        Some(p) => p,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    };

    if playlist.userid != user.id.unwrap() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    }

    if !PlaylistTable::delete(&playlist, &conn) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to delete playlist"}))).into_response()
    }

    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}

async fn get_songs_playlist(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<PlaylistParams>,
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let exists = match PlaylistTable::get_by_id(params.playlist_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let playlist = match exists {
        Some(p) => p,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    };

    if playlist.userid != user.id.unwrap() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    }

    let songs = match PlaylistEntryTable::get_by_playlist(playlist.id.unwrap(), &conn) {
        Ok(s) => s,
        Err(e) => {
            let msg = format!("failed to get playlist from db -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    return (StatusCode::OK, Json(json!({"status": "ok", "songs": songs}))).into_response()
}

#[derive(Deserialize)]
struct PlaylistEntryParams {
    playlist_id: i32,
    song_id: i32,
}

async fn add_song_playlist(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<PlaylistEntryParams>,
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let exists = match PlaylistTable::get_by_id(params.playlist_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let m_exists = match MusicTable::get_by_id(params.song_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let playlist = match exists {
        Some(p) => p,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()};
    
    let song = match m_exists {
        Some(s) => s,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "song doesn't exist"}))).into_response()
    };

    if playlist.userid != user.id.unwrap() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    }

    let test = match PlaylistEntryTable::get_by_playlist(playlist.id.unwrap(), &conn) {
        Ok(t) => t,
        Err(_) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to get playlist for working out pos"})))
                .into_response();
        }
    };

    let entry = PlaylistEntryRow {
        id: None,
        pos: test.len() as i32,
        playlist_id: playlist.id.unwrap(),
        entry_id: song.id.unwrap(),
        notes: None,
        date_added: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
    };

    if !PlaylistEntryTable::insert(&entry, &conn) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to insert song into playlist" }))).into_response()
    }
    
    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}

#[derive(Deserialize)]
struct PlaylistDeleteEntryParams {
    playlist_id: i32,
    entry_id: i32,
}

async fn delete_song_playlist (
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<PlaylistDeleteEntryParams>,
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let exists = match PlaylistTable::get_by_id(params.playlist_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let m_exists = match PlaylistEntryTable::get_by_id(params.entry_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let playlist = match exists {
        Some(p) => p,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    };

    let entry = match m_exists {
        Some(s) => s,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    };

    let b_exists = match MusicTable::get_by_id(entry.entry_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };
    
    let _ = match b_exists {
        Some(s) => s,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "song doesn't exist (weird error)"}))).into_response()
    };

    if playlist.userid != user.id.unwrap() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    }
    
    if !PlaylistEntryTable::delete(&entry, &conn) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to delete song into playlist" }))).into_response()
    }

    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}

#[derive(Deserialize)]
struct PlaylistReplaceEntryParams {
    playlist_id: i32,
    entry_id: i32,
    pos: i32,
    notes: Option<String>
}

async fn replace_song_playlist(
    JwtAuth(claims): JwtAuth,
    State(state): State<Arc<AppState>>,
    Form(params): Form<PlaylistReplaceEntryParams>,
) -> impl IntoResponse {
    let conn = match state.db.pool.get() {
        Ok(c) => c,
        Err(_) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "internal error" }))).into_response(),
    };

    let user = match UsersTable::get_by_username(&claims.sub, &conn) {
        Ok(Some(user)) => user,
        Ok(None) | Err(_) => return (StatusCode::UNAUTHORIZED, Json(json!({ "status": "error",
                                                 "reason": "jwt found but username is not found in db mismatch between signed values and db" }))).into_response()
    };

    let exists = match PlaylistTable::get_by_id(params.playlist_id, &conn) {
        Ok(exists) => exists,
        Err(e) => {
            let msg = format!("db failed -> {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": msg }))).into_response()
        }
    };

    let playlist = match exists {
        Some(p) => p,
        None => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    };

    if playlist.userid != user.id.unwrap() {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "playlist doesn't exist"}))).into_response()
    }

    let mut old = match PlaylistEntryTable::get_by_id(params.entry_id, &conn) {
        Ok(Some(t)) => t,
        Err(_) | Ok(None) => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "old playlist entry doesnt exist"})))
                .into_response();
        }
    };

    old.notes = params.notes;
    old.pos = params.pos;

    if !PlaylistEntryTable::replace(&old, &conn) {
        return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({ "status": "error", "reason": "failed to replace song into playlist" }))).into_response()
    }
    
    return (StatusCode::OK, Json(json!({"status": "ok"}))).into_response()
}


pub fn create_api_routes(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
            "http://localhost:8080".parse::<HeaderValue>().unwrap(),
        ]))
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true);

    let arc = Arc::new(state.clone());

    let user_service = Router::new()
        .route("/verify", get(verify_handler))
        .route("/login", post(login_handler)).with_state(arc.clone())
        .route("/changepass", post(change_password_handler).with_state(arc.clone()));

    let music_static_service = Router::new()
        .route("/static/*file", get({
            move |JwtAuth(claims): JwtAuth, State(state): State<Arc<AppState>>, uri: Uri| {
                async move { serve_music_service(JwtAuth(claims), State(state), uri).await }
            }
        }))
        .route("/cover/*file", get({
            move |State(state): State<Arc<AppState>>, uri: Uri| {
                async move { serve_cover(State(state), uri).await }
            }
        }))
        .with_state(arc.clone());

    let music_service = Router::new()
        .route("/upload", post(upload_handler)).with_state(arc.clone())
        .route("/get", get(get_music_handler));

    let playlist_service = Router::new()
        .route("/get", get(get_playlist)).with_state(arc.clone())
        .route("/new", post(new_playlist)).with_state(arc.clone())
        .route("/delete", post(delete_playlist)).with_state(arc.clone())
        .route("/song/add", post(add_song_playlist)).with_state(arc.clone())
        .route("/song/get", post(get_songs_playlist)).with_state(arc.clone())
        .route("/song/change", post(replace_song_playlist)).with_state(arc.clone())
        .route("/song/delete", post(delete_song_playlist)).with_state(arc.clone());

    let r = Router::new()
        .nest("/user", user_service)
        .nest("/playlist", playlist_service)
        .nest("/music", music_service)
        .nest("/music", music_static_service)
        .layer(cors)
        .layer(DefaultBodyLimit::max(20 * 1024 * 1024))
        .with_state(arc);

    return r
}
