use std::path::Path;
use std::fs::{File, read_to_string, remove_file, read_dir};
use std::io::Write;
use std::error::Error;
use std::process::{Command, Stdio, exit};
use std::env;

use id3::{Tag, TagLike};
use chrono::Local;
use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;
use axum::{Router, serve};
use serde::Serialize;
use std::{thread, net::SocketAddr};
use tokio::{runtime::Builder, net::TcpListener};

use rusqlite::{Connection, OptionalExtension, Result};
// use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT};
// use regex::Regex;
// use serde_json::Value;

use crate::log;
use crate::utils::log::LogLevel;
use crate::server::{create_api_routes, create_app_routes};

const PID_FILE: &str = "/tmp/bine.pid";
const CHILD_OUT_FILE: &str = "/tmp/bineout.log";
const CHILD_ERR_FILE: &str = "/tmp/bineerr.log";
const CHILD_ENV_VAR: &str = "BINE_CHILD_PROCESS";

const APP_PORT: u16 = 8080;
const API_PORT: u16 = 3000;

const DB_PATH: &str = "/Users/crack/Bang/bandosquatter/target/debug.db";
const MUSIC_DIR: &str = "";

pub fn check_is_child() {
    if std::env::var(CHILD_ENV_VAR).is_ok() {
        log!(LogLevel::Info, "{:-<48}", "");
        let now = Local::now();
        let time = now.format("%d/%m/%Y %H:%M").to_string();
        log!(LogLevel::Info, "Started background process at {}", time);
        log!(LogLevel::Info, "{:-<48}", "");
        child_work();
        exit(1);
    }
}

struct BSDatabase {
    migration_path: &'static str,
    conn: Connection,
    migrations: Vec<String>,
}

impl BSDatabase {
    pub fn new(path: &'static str, conn: Connection) -> BSDatabase {
        BSDatabase {
            migration_path: path,
            conn,
            migrations: Vec::new(),
        }
    }

    fn get_migrations(&mut self) -> Result<(), Box<dyn Error>> {
        let mp = Path::new(self.migration_path);

        if !mp.exists() || !mp.is_dir() {
            return Err("the migration_path didn't exist or is a file".into());
        }

        let mut migrations_numeric: Vec<(usize, String)> = Vec::new();

        for entry in read_dir(mp)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                return Err("cant support directories in migration dir".into());
            }

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "sql" {
                        let stem = path
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .ok_or(format!("invalid filename for {:?}", path))?;

                        if !stem.chars().all(|c| c.is_ascii_digit()) {
                            return Err(format!("sql file '{}' must have a numeric name", stem).into());
                        }

                        let index: usize = stem.parse()?;
                        let content = read_to_string(&path)?;
                        migrations_numeric.push((index, content));
                    }
                }
            }
        }

        migrations_numeric.sort_by_key(|(index, _)| *index);

        for (expected, (actual, _)) in (0..).zip(&migrations_numeric) {
            if expected != *actual {
                return Err(format!(
                    "migration files must be sequential starting at 0; missing migration {}",
                    expected
                )
                .into());
            }
        }

        self.migrations = migrations_numeric.into_iter().map(|(_, content)| content).collect();

        Ok(())
    }

    fn apply_migrations(&self) {
        for migr in self.migrations.clone() {
            if let Err(err) = self.conn.execute(&migr, []) {
                log!(LogLevel::Debug, "failed to apply err -> {}\nmigration -> {}", err, migr);
            } else {
                log!(LogLevel::Debug, "applied migration -> \n{}", migr)
            }
        }
    }
}

#[derive(Serialize)]
pub struct UsersTable {
    id: Option<i32>,
    username: String,
    password: String,
    date_added: String,
}

impl UsersTable {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        return Ok(Self {
            id: row.get(0)?,
            username: row.get(1)?,
            password: row.get(2)?,
            date_added: row.get(3)?,
        })
    }
}

pub struct UsersTables {}

impl UsersTables {
    pub fn insert(data: UsersTable, conn: Connection) -> bool {
        let res = conn.execute("INSERT INTO users (username, password, dateAdded) VALUES (?1, ?2, ?3)",
                     (&data.username, &data.password, &data.date_added));

        if let Err(err) = res {
            log!(LogLevel::Err, "insert user failed err -> {}", err);
            return false 
        }

        return true
    }

    pub fn replace(data: UsersTable, conn: &Connection) -> bool {
        let res = conn.execute("INSERT OR REPLACE INTO users (id, username, password, dateAdded) VALUES (?1, ?2, ?3, ?4)",
                     (&data.id, &data.username, &data.password, &data.date_added));
        
        if let Err(err) = res {
            log!(LogLevel::Err, "replace user failed err -> {}", err);
            return false
        }
        
        return true
    }

    pub fn get_by_id(conn: &Connection, id: i32) -> rusqlite::Result<Option<UsersTable>> {
        return conn.query_row(
            "SELECT id, username, password, dateAdded FROM users WHERE id = ?1",
            [id],
            UsersTable::from_row,
        ).optional()
    }

    pub fn get_by_username(conn: &Connection, username: &str) -> rusqlite::Result<Option<UsersTable>> {
        return conn.query_row(
            "SELECT id, username, password, dateAdded FROM users WHERE username = ?1",
            [username],
            UsersTable::from_row,
        ).optional()
    }
}

struct MusicTable {
    // id: i32,
    url: String,
    title: String,
    artist: String,
    album: Option<String>,
    year: Option<i32>,
    date_added: String,
}

fn setup_files() {
    let tag = Tag::read_from_path("").unwrap_or_else(|_| {
        exit(1);
    });

    if let Some(title) = tag.title() {
        println!("Title: {}", title);
    }

    if let Some(artist) = tag.artist() {
        println!("Artist: {}", artist);
    }

    if let Some(album) = tag.album() {
        println!("Album: {}", album);
    }

    if let Some(year) = tag.year() {
        println!("Year: {}", year);
    }
}


async fn setup_api() -> Result<(), Box<dyn Error>> {
    // let test1 = YoutubeDownload::init("https://www.youtube.com/watch?v=gN_ogS2cHNo");

    // if let Err(err) = test1.send().await {
    //     log!(LogLevel::Err, "youtube download failed reason -> {}", err);
    // }

    // ---------------------------------------------------------------------------

    let db_path = Path::new(DB_PATH);

    if !db_path.exists() {
        if let Err(err) = File::create(db_path) {
            return Err(format!("failed to create db file... db path -> {}, error -> {}", DB_PATH, err).into());
        }
    }

    let conn = Connection::open(db_path)?;

    let mut db = BSDatabase::new("/Users/crack/Bang/bandosquatter/src/migr/", conn);

    if let Err(err) = db.get_migrations() {
        log!(LogLevel::Err, "db get_migrations err -> {}", err);
    }

    db.apply_migrations();

    // conn.execute(
    //     "INSERT INTO user (name, age) VALUES (?1, ?2)",
    //     params!["Alice", 30],
    // )?;

    // let mut stmt = conn.prepare("SELECT id, name, age FROM user")?;
    // let users = stmt.query_map([], |row| {
    //     Ok((
    //         row.get::<_, i32>(0)?,
    //         row.get::<_, String>(1)?,
    //         row.get::<_, i32>(2)?,
    //     ))
    // })?;

    Ok(())
}

fn child_work() {
    let html_t = thread::spawn(|| {
        let rt = Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            let app = create_app_routes();

            let addr = SocketAddr::from(([127, 0, 0, 1], APP_PORT));

            let listener = TcpListener::bind(addr).await.unwrap();

            log!(LogLevel::Info, "html server on http://{}", addr);

            serve(listener, app.into_make_service()).await.unwrap();
        });
    });

    let api_t = thread::spawn(|| {
        let rt = Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        rt.block_on(async {
            setup_api().await.unwrap_or_else(|e| {
                log!(LogLevel::Err, "setup api: {e:?}");
            }); 

            let app = create_api_routes();

            let addr = SocketAddr::from(([127, 0, 0, 1], API_PORT));

            let listener = TcpListener::bind(addr).await.unwrap();

            log!(LogLevel::Info, "api server on http://{}", addr);

            serve(listener, app.into_make_service()).await.unwrap();
        });
    });
    
    html_t.join().unwrap();
    api_t.join().unwrap();
}

pub fn start_daemon(_args: Vec<String>) -> i32 {
    if Path::new(PID_FILE).exists() {
        log!(LogLevel::Err, "process is already running pid file at {}", PID_FILE);
        return 1
    }

    let exe = match env::current_exe() {
        Ok(s) => s,
        Err(e) => {
            log!(LogLevel::Err, "failed to get the current exe path: {}", e);
            return 1
        }
    };

    let dout_file = File::create(CHILD_OUT_FILE);
    let derr_file = File::create(CHILD_ERR_FILE);

    if dout_file.is_err() || derr_file.is_err() {
        log!(LogLevel::Err, "failed to create out and err files for child process...");
        return 1
    }

    let child = Command::new(exe)
        .env(CHILD_ENV_VAR, "1")
        .stdin(Stdio::null())
        .stdout(dout_file.unwrap())
        .stderr(derr_file.unwrap())
        .spawn()
        .unwrap_or_else(|e| {
            log!(LogLevel::Err, "failed to fork into the background: {}", e);
            exit(1);
        });

    let mut pidfile = match File::create(PID_FILE) {
        Ok(s) => s,
        Err(e) => {
            log!(LogLevel::Err, "file to write the pid file use ps aux to shut the child process: {}", e);
            return 1
        }
    };

    if write!(pidfile, "{}", child.id()).is_err() {
        log!(LogLevel::Err, "failed to write to the pid file use ps aux to shut child process");
        return 1
    }

    log!(LogLevel::Info, "successfully started the background process with pid {}", child.id());

    return 0
}

pub fn stop_daemon(_args: Vec<String>) -> i32 {
    if !Path::new(PID_FILE).exists() {
        log!(LogLevel::Err, "pid file does not exist daemon probably isnt running.");
        return 1
    }

    let pid_str = match read_to_string(PID_FILE) {
        Ok(s) => s,
        Err(e) => {
            log!(LogLevel::Err, "failed to read pid file: {}", e);
            return 1
        }
    };

    let pid: u32 = match pid_str.trim().parse() {
        Ok(n) => n,
        Err(e) => {
            log!(LogLevel::Err, "invalid pid in file: {}", e);
            return 1
        }
    };

    if let Err(e) = kill(Pid::from_raw(pid as i32), Signal::SIGTERM) {
        log!(LogLevel::Err, "failed to kill process {}: {}", pid, e);
        return 1;
    }

    if let Err(e) = remove_file(PID_FILE) {
        log!(LogLevel::Err, "failed to remove pid file: {}", e);
        return 1
    }

    log!(LogLevel::Info, "successfully stopped background process with pid {}", pid);

    return 0
}
