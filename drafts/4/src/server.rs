use axum::{
    body::Body, http::{Request, StatusCode}, response::{Html, IntoResponse, Response}, routing::{get, get_service}, Json, Router,
    extract::{Query, State}
};
use serde::Deserialize;
use serde_json::json;
use tower::service_fn;
use tower_http::services::ServeDir;
use std::convert::Infallible;

use crate::background::UsersTables;

const HTTP_DIR: &str = "/Users/crack/Bang/bandosquatter/html/";

use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use std::sync::Arc;

#[derive(Deserialize)]
struct GetUserParams {
    id: Option<i32>,
    username: Option<String>,
}

#[derive(Clone)]
struct AppState {
    pool: Pool<SqliteConnectionManager>,
}

async fn custom_404_handler() -> (StatusCode, Html<String>) {
    let path = format!("{HTTP_DIR}/assets/404.html");
    let html = tokio::fs::read_to_string(&path).await.unwrap_or_else(|_| {
        "<h1>404</h1><p>could not load 404 page.</p>".to_string()
    });
    (StatusCode::NOT_FOUND, Html(html))
}

pub fn create_app_routes() -> Router {
    let fallback_service = service_fn(|_req: Request<Body>| async {
        let res = custom_404_handler().await.into_response();
        Ok::<Response<Body>, Infallible>(res)
    });
    
    let serve_dir = ServeDir::new(HTTP_DIR).fallback(fallback_service);
    
    let service = get_service(serve_dir).handle_error(|error| async move {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("unhandled internal error: {}", error),
        )
    });

    let r = Router::new().nest_service("/", service);
    
    return r;
}

async fn get_user_handler(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    // how can i say pass parameters so either like ?id={number} or ?username={} but not both

    let conn = state.pool.get().unwrap();

    let maybe_user = UsersTables::get_by_id(&conn, 1).unwrap();

    Json(json!({ "user": maybe_user }))
}

pub fn create_api_routes(state: AppState) -> Router {
    let user = Router::new().route("/get", get(get_user_handler)).with_state(state.clone());

    let r = Router::new()
       .route("/", get(|| async {
           Json(json!({ "hello": "from API thread" }))
       }));

    return r
}
