mod utils;
mod youtube;

use serde_json::Value;
use crate::utils::log::LogLevel;

#[tokio::main]
async fn main() {
    let url = "https://www.youtube.com/watch?v=gN_ogS2cHNo";

    let player_response: Value = youtube::make_youtube_request(url).await.unwrap_or_else(|e| {
        log!(LogLevel::Err, "make_youtube_request failed: {e:?}");
        std::process::exit(1);
    });

    let parsed = youtube::parse_streaming_data(&player_response).unwrap_or_else(|e| {
        log!(LogLevel::Err, "parse_streaming_data failed: {e:?}");
        std::process::exit(1);
    });

    let sig = youtube::parse_signature(parsed.formats);

    log!(LogLevel::Debug, "url: {}", sig.url);
    log!(LogLevel::Debug, "sig: {}", sig.sig);
    log!(LogLevel::Debug, "sp: {}", sig.sp);
}
