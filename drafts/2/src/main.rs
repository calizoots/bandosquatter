use std::error::Error;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde_json::Value;

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Err,
    Warn,
    Debug,
    Bias,
}

impl LogLevel {
    pub fn resolve_message(&self) -> &'static str {
        match self {
            LogLevel::Info => "\x1b[34m[info]:\x1b[0m",
            LogLevel::Err => "\x1b[31m[error]:\x1b[0m",
            LogLevel::Warn => "\x1b[33m[warning]:\x1b[0m",
            LogLevel::Debug => "\x1b[38;5;208m[debug]:\x1b[0m",
            LogLevel::Bias => "\x1b[35m[bias]:\x1b[0m",
        }
    }
}

#[macro_export]
macro_rules! log {
    ($level:expr, $($arg:tt)*) => ({
        print!("{} ", $level.resolve_message());
        println!($($arg)*);
    })
}

async fn make_youtube_request(url: &'static str) -> Result<Value, Box<dyn Error>> {
    let mut headers = HeaderMap::new();

    headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0"));

    let client = reqwest::Client::new();

    let res = client.get(url).headers(headers).send().await?;

    let html = res.text().await?;

    let re = Regex::new(r"ytInitialPlayerResponse\s*=\s*(\{.*\})\s*;")?;

    let caps = re
        .captures(&html)
        .ok_or_else(|| "couldn't find ytInitialPlayerResponse")?;

    let json_str = &caps[1];
    let player_response: Value = serde_json::from_str(json_str)?;

    return Ok(player_response)
}

struct YoutubeVideoFormat<'a> {
    mime: &'a str,
    cipher: Option<&'a str>
}

struct YoutubeStreamingData<'a> {
    raw_url: Option<&'a str>,
    formats: Vec<YoutubeVideoFormat<'a>>,
    adaptive_formats: Vec<YoutubeVideoFormat<'a>>,
}

struct YoutubeSignature<'a> {
    sig: &'a str,
    sp: &'a str,
    url: &'a str,
}

impl YoutubeStreamingData<'_> {
    fn print(&self) {
        for format in &self.formats {
            log!(LogLevel::Info, "mimeType: {}", format.mime);
        
            if let Some(cipher) = format.cipher { 
                log!(LogLevel::Info, "signature cipher: {}", cipher);
            } else {
                log!(LogLevel::Bias, "no signature cipher for this one!")
            }
        }

        for format in &self.adaptive_formats {
            log!(LogLevel::Info, "mimeType: {}", format.mime);
        
            if let Some(cipher) =format.cipher {
                log!(LogLevel::Info, "signature cipher: {}", cipher);
            } else {
                log!(LogLevel::Bias, "adaptiveFormat: no signature cipher for this one!")
            }
        }
    }
}

fn parse_streaming_data(data: &Value) -> Result<YoutubeStreamingData, Box<dyn Error>> {
    let streaming_data = data
        .get("streamingData")
        .ok_or("missing streamingData")?;

    let raw_url = streaming_data.get("serverAbrStreamingUrl").and_then(|u| u.as_str());

    if let Some(url) = raw_url {
        log!(LogLevel::Info, "direct url: {}", url);
    }

    let formats = streaming_data.get("formats").and_then(|f| f.as_array()).ok_or("missing formats")?;
    let adaptive_formats = streaming_data.get("adaptiveFormats").and_then(|af| af.as_array()).ok_or("missing adaptiveFormats")?;

    let mut result = YoutubeStreamingData {
        raw_url,
        adaptive_formats: vec![],
        formats: vec![],
    };

    for format in formats {
        let mime = format.get("mimeType").and_then(|m| m.as_str()).unwrap_or_else(|| {
            log!(LogLevel::Err, "missing mime type of format must be malformed data");
            std::process::exit(1);
        });
    
        let cipher = format.get("signatureCipher").and_then(|c| c.as_str());

        result.formats.push(YoutubeVideoFormat {
            mime,
            cipher
        })
    }

    for format in adaptive_formats {
        let mime = format.get("mimeType").and_then(|m| m.as_str()).unwrap_or_else(|| {
            log!(LogLevel::Err, "missing mime type of format must be malformed data");
            std::process::exit(1);
        });
    
        let cipher = format.get("signatureCipher").and_then(|c| c.as_str());

        result.adaptive_formats.push(YoutubeVideoFormat {
            mime,
            cipher
        })
    }

    return Ok(result)
}

fn parse_signature(formats: Vec<YoutubeVideoFormat>) -> YoutubeSignature<'_> {
    let mut unparsed_sig: &str = "";

    for format in &formats {
        if let Some(cipher) = format.cipher {
            unparsed_sig = cipher;
            break;
        }
    }

    if unparsed_sig == "" {
        log!(LogLevel::Err, "failed to identify a single signatureCipher");
        std::process::exit(1);
    }

    let parts: Vec<&str> = unparsed_sig.split("&").collect();

    if parts.len() < 3 {
        log!(LogLevel::Err, "length of parts in the signatureCipher are wrong");
        std::process::exit(1);
    }

    let mut sig: Option<&str> = None;
    let mut sp: Option<&str> = None;
    let mut url: Option<&str> = None;

    for part in &parts {
        let keyvalue: Vec<&str> = part.splitn(2, "=").collect();

        if keyvalue.len() < 2 {
            log!(LogLevel::Err, "key value is malformed: {keyvalue:?}");
            break;
        }

        let key = keyvalue[0];
        let value = keyvalue[1];

        match key {
            "s" => sig = Some(value),
            "url" => url = Some(value),
            "sp" => sp = Some(value),

            other => { 
                log!(LogLevel::Err, "unrecgonised key found: {other} value: {value}");
                break 
            } 
        }
    }

    let sig_data = match (sig, sp, url) {
        (Some(sig), Some(sp), Some(url)) => YoutubeSignature { sig, sp, url },
        _ => {
            log!(LogLevel::Err, "missing one or more required fields: s, sp, url");
            std::process::exit(1);
        }
    };
    
    return sig_data
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    // println!("{:#}", player_response);
    let url = "https://www.youtube.com/watch?v=gN_ogS2cHNo";

    let player_response: Value = make_youtube_request(url).await.unwrap_or_else(|e| {
        log!(LogLevel::Err, "make_youtube_request failed: {e:?}");
        std::process::exit(1);
    });

    let parsed = parse_streaming_data(&player_response)?;

    let sig = parse_signature(parsed.formats);



    log!(LogLevel::Debug, "url: {}", sig.url);
    log!(LogLevel::Debug, "sig: {}", sig.sig);
    log!(LogLevel::Debug, "sp: {}", sig.sp);

    return Ok(())
}
