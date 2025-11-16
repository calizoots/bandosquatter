use std::error::Error;
use regex::Regex;
use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
use serde_json::Value;

use crate::log;
use crate::utils::log::LogLevel;

pub struct YtVideoFormat<'a> {
    pub mime: &'a str,
    pub cipher: Option<&'a str>
}

pub struct YtSignature<'a> {
    pub sig: &'a str,
    pub sp: &'a str,
    pub url: &'a str,
}

pub struct YtStreamingData<'a> {
    pub raw_url: Option<&'a str>,
    pub formats: Vec<YtVideoFormat<'a>>,
    pub adaptive_formats: Vec<YtVideoFormat<'a>>,
}

impl YtStreamingData<'_> {
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

pub async fn make_youtube_request(url: &'static str) -> Result<Value, Box<dyn Error>> {
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

pub fn parse_streaming_data(data: &Value) -> Result<YtStreamingData, Box<dyn Error>> {
    let streaming_data = data
        .get("streamingData")
        .ok_or("missing streamingData")?;

    let raw_url = streaming_data.get("serverAbrStreamingUrl").and_then(|u| u.as_str());

    if let Some(url) = raw_url {
        log!(LogLevel::Info, "direct url: {}", url);
    }

    let formats = streaming_data.get("formats").and_then(|f| f.as_array()).ok_or("missing formats")?;
    let adaptive_formats = streaming_data.get("adaptiveFormats").and_then(|af| af.as_array()).ok_or("missing adaptiveFormats")?;

    let mut result = YtStreamingData {
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

        result.formats.push(YtVideoFormat {
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

        result.adaptive_formats.push(YtVideoFormat {
            mime,
            cipher
        })
    }

    return Ok(result)
}

pub fn parse_signature(formats: Vec<YtVideoFormat>) -> YtSignature<'_> {
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
        (Some(sig), Some(sp), Some(url)) => YtSignature { sig, sp, url },
        _ => {
            log!(LogLevel::Err, "missing one or more required fields: s, sp, url");
            std::process::exit(1);
        }
    };
    
    return sig_data
}
