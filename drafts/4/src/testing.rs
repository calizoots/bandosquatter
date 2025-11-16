struct YoutubeDownload {
    url: &'static str,
    client: reqwest::Client,
    headers: HeaderMap,
}

impl YoutubeDownload {
    pub fn init(url: &'static str) -> YoutubeDownload {
        let mut headers = HeaderMap::new();

        headers.insert(USER_AGENT, HeaderValue::from_static("Mozilla/5.0"));

        return YoutubeDownload {
            client: reqwest::Client::new(),
            url,
            headers,
        }
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, Box<dyn Error>> {
        let res = self.client.get(url)
            .headers(self.headers.clone())
            .send()
            .await?;
        return Ok(res)
    }

    pub fn get_initial_function_name(js: &str) -> Result<String, Box<dyn Error>> {
        let function_patterns = [
            r"\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*encodeURIComponent\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r#"(?:\b|[^a-zA-Z0-9$])(?P<sig>[a-zA-Z0-9$]{2})\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)"#,
            r#"(?P<sig>[a-zA-Z0-9$]+)\s*=\s*function\(\s*a\s*\)\s*\{\s*a\s*=\s*a\.split\(\s*""\s*\)"#,
            //r#"(["\'])signature\1\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\("#,
            r#"(['"])\s*signature\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\("#,
            r"\.sig\|\|(?P<sig>[a-zA-Z0-9$]+)\(",
            r"yt\.akamaized\.net/\)\s*\|\|\s*.*?\s*[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?:encodeURIComponent\s*\()?\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\b[cs]\s*&&\s*[adf]\.set\([^,]+\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\b[a-zA-Z0-9]+\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\bc\s*&&\s*a\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\bc\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(",
            r"\bc\s*&&\s*[a-zA-Z0-9]+\.set\([^,]+\s*,\s*\([^)]*\)\s*\(\s*(?P<sig>[a-zA-Z0-9$]+)\(",
        ];

        for pattern in function_patterns.iter() {
            let re = Regex::new(pattern)?;
            if let Some(caps) = re.captures(js) {
                if let Some(m) = caps.get(1) {
                    log!(LogLevel::Debug, "here -> {}", m.as_str().to_string());
                    return Ok(m.as_str().to_string());
                }
            }
        }

        Err("Couldn't find initial function name".into())
    }

    pub fn get_transform_plan(js: &str) -> Result<Vec<String>, Box<dyn Error>> {
        let name = Self::get_initial_function_name(js)?;
        let pattern = format!(
            r#"{}=function\(\w\)\{{[a-z=\.\("\)]*;(.*?);(?:.+?)\}}"#,
            regex::escape(&name)
        );

        log!(LogLevel::Debug, "pattern -> {}", pattern);

        let re = Regex::new(&pattern)?;
        if let Some(caps) = re.captures(js) {
            if let Some(plan) = caps.get(1) {
                let steps: Vec<&str> = plan.as_str().split(';').collect();
                return Ok(steps.into_iter().map(|s| s.to_string()).collect::<Vec<String>>());
            }
        } else {
            log!(LogLevel::Debug, "transform plan pattern wasn't found");
        }

        Err("Couldn't extract transform plan".into())
    }

    async fn send(&self) -> Result<(), Box<dyn Error>> {
        let res = self.get(self.url).await?;
        let html = res.text().await?;

        let re_js = Regex::new(r#"<script\s+src="([^"]+base\.js)""#)?;
        let js_caps = re_js
            .captures(&html)
            .ok_or("Couldn't find base.js")?;
        let js_url_path = "https://www.youtube.com".to_string() + &js_caps[1];

        let re = Regex::new(r"ytInitialPlayerResponse\s*=\s*(\{.*\})\s*;")?;
        let caps = re
            .captures(&html)
            .ok_or("Couldn't find ytInitialPlayerResponse")?;

        let json_str = &caps[1];
        let player_response: Value = serde_json::from_str(json_str)?;

        // log!(LogLevel::Debug, "{:#}", player_response);
        log!(LogLevel::Debug, "{:#}", player_response["streamingData"]["formats"]);

        log!(LogLevel::Debug, "js_url_path -> {}", js_url_path);

        let js_res = self.get(&js_url_path).await?;
        let _js = js_res.text().await?;

        // log!(LogLevel::Debug, "{}", js);

        // let transform_plan = YoutubeDownload::get_transform_plan(&js)?;
        // log!(LogLevel::Debug, "Transform plan: {:?}", transform_plan);

        return Ok(())
    }
}
