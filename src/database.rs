use std::{env, fmt, fs::{self, read_dir, read_to_string}, io::Cursor, path::{Path, PathBuf}, process::exit, sync::{Arc, RwLock}, time::{SystemTime, UNIX_EPOCH}};

use chrono::Utc;
use id3::{frame::PictureType, Content, Tag, TagLike, Version};
use image::{DynamicImage, ImageBuffer, ImageError, ImageFormat, Rgb, RgbImage};
use r2d2::{Pool, PooledConnection};
use r2d2_sqlite::{rusqlite::{self, OptionalExtension, Statement}, SqliteConnectionManager};
use rust_embed::Embed;
use serde::Serialize;

use crate::{log, utils::{AnyError, LogLevel}};

pub type DBPool = Pool<SqliteConnectionManager>;
pub type DBPoolItem = PooledConnection<SqliteConnectionManager>;

const DEV_MIGR_DIR: &str = "/Users/crack/Bang/bandosquatter/migr/";

#[derive(Embed)]
#[folder = "migr/"]
struct EmbeddedMigrations;

#[derive(Clone)]
pub struct BSDatabase {
    pub pool: Arc<DBPool>,
    migrations: Vec<String>,
}

impl BSDatabase {
    pub fn new(mng: SqliteConnectionManager) -> AnyError<BSDatabase> {
        return Ok(BSDatabase {
            pool: Arc::new(Pool::new(mng)?),
            migrations: Vec::new(),
        })
    }

    pub fn get_migrations(&mut self) -> AnyError<()> {
        if cfg!(debug_assertions) {
            let dir = match env::var("MIGR_DIR") {
                Ok(dir) => dir,
                Err(_) => DEV_MIGR_DIR.to_string()
            };

            let mp = Path::new(&dir);

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

                if path.is_file() && path.extension().map(|e| e == "sql").unwrap_or(false) {
                    let stem = path.file_stem()
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

            migrations_numeric.sort_by_key(|(i, _)| *i);
            for (expected, (actual, _)) in (0..).zip(&migrations_numeric) {
                if expected != *actual {
                    return Err(format!(
                        "migration files must be sequential starting at 0; missing migration {}",
                        expected
                    ).into());
                }
            }

            self.migrations = migrations_numeric.into_iter().map(|(_, c)| c).collect();
        } else {
            let mut migrations_numeric: Vec<(usize, String)> = Vec::new();

            for file in EmbeddedMigrations::iter() {
                let fname = file.as_ref();
                if let Some(ext) = Path::new(fname).extension() {
                    if ext == "sql" {
                        let stem = Path::new(fname)
                            .file_stem()
                            .and_then(|s| s.to_str())
                            .ok_or(format!("invalid filename for {:?}", fname))?;

                        if !stem.chars().all(|c| c.is_ascii_digit()) {
                            return Err(format!("sql file '{}' must have a numeric name", stem).into());
                        }

                        let index: usize = stem.parse()?;
                        let content = EmbeddedMigrations::get(fname)
                            .ok_or(format!("embedded migration missing {:?}", fname))?;
                        let sql = std::str::from_utf8(content.data.as_ref())?.to_string();

                        migrations_numeric.push((index, sql));
                    }
                }
            }

            migrations_numeric.sort_by_key(|(i, _)| *i);
            for (expected, (actual, _)) in (0..).zip(&migrations_numeric) {
                if expected != *actual {
                    return Err(format!(
                        "embedded migration files must be sequential starting at 0; missing migration {}",
                        expected
                    ).into());
                }
            }

            self.migrations = migrations_numeric.into_iter().map(|(_, c)| c).collect();
        }

        Ok(())
    }

    pub fn apply_migrations(&self) -> AnyError<()> {
        for migr in self.migrations.clone() {
            let conn = self.pool.get()?;

            if let Err(err) = conn.execute_batch(&migr) {
                log!(LogLevel::Err, "failed to apply err -> {}\nmigration -> {}", err, migr);
            } else {
                log!(LogLevel::Debug, "applied migration -> \n{}", migr)
            }
        }

        return Ok(())
    }
}

fn black_placeholder_cover(size: u32) ->  ImageBuffer<Rgb<u8>, Vec<u8>>{
    return RgbImage::from_pixel(size, size, Rgb([0, 0, 0]));
}

fn remove_embedded_pictures(path: &Path) -> Result<(), id3::Error> {
    let mut tag = Tag::read_from_path(path)?;
    
    tag.remove_all_pictures();

    tag.write_to_path(path, Version::Id3v24)?;
    Ok(())
}

// STORAGE MANAGER

#[derive(Clone)]
pub struct LocalStorageManager {
    root_dir: Arc<RwLock<PathBuf>>,
}

impl LocalStorageManager {
    pub fn new<P: Into<PathBuf>>(initial_dir: P) -> Self {
        Self {
            root_dir: Arc::new(RwLock::new(initial_dir.into())),
        }
    }

    pub fn set_root_dir<P: Into<PathBuf>>(&self, new_dir: P) {
        let mut dir = self.root_dir.write().unwrap();
        *dir = new_dir.into();
    }

    pub fn get_root_dir(&self) -> PathBuf {
        self.root_dir.read().unwrap().clone()
    }

    pub fn get_cover_dir(&self, username: &str) -> PathBuf {
        let root = self.get_root_dir();
        let cover_dir = root.join(username).join("covers");

        // create the directory if it doesn't exist
        if !cover_dir.exists() {
            if let Err(err) = fs::create_dir_all(&cover_dir) {
                log!(LogLevel::Err, "Failed to create cover directory: {}", err);
            }
        }

        cover_dir
    }

    pub fn title_to_filename(title: &str) -> String {
        title
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
            .collect::<String>() + ".jpg"
    }

    pub fn save_cover(&self, user: &UsersRow, cover: &RgbImage, title: &str) -> Result<(), ImageError> {
        let path = self.get_cover_dir(&user.username).join(Self::title_to_filename(title));
        
        cover.save_with_format(path, ImageFormat::Jpeg)
    }

    pub fn delete_cover(&self, user: &UsersRow, title: &str) -> AnyError<()> {
        let filename = Self::title_to_filename(title);
        let cover_path = self.get_cover_dir(&user.username).join(filename);
        if cover_path.exists() {
            fs::remove_file(cover_path)?;
        }
        Ok(())
    }

    pub fn get_cover(&self, user: &UsersRow, title: &str) -> Option<PathBuf> {
        let filename = Self::title_to_filename(title);
        let cover_path = self.get_cover_dir(&user.username).join(filename);
        if cover_path.exists() {
            Some(cover_path)
        } else {
            None
        }
    }

    pub fn ensure_user_folders(&self, conn: &DBPoolItem) -> AnyError<()> {
        let users = UsersTable::get_all(conn)?;

        let root = self.get_root_dir();

        for user in users {
            let user_folder = root.join(&user.username);
            if !user_folder.exists() {
                let _ = self.get_cover_dir(&user.username);

                fs::create_dir_all(user_folder)?;
            }
        }
        return Ok(())
    }

    pub fn user_folder(&self, username: &str) -> PathBuf {
        self.get_root_dir().join(username)
    }

    pub fn parse_single_song(&self, user: &UsersRow, path: &str) -> AnyError<MusicRow> {
        let user_dir = self.user_folder(&user.username);

        if !user_dir.exists() {
            return Err("user folder doesn't exist".into());
        }

        let path = PathBuf::from(path);
        
        let tag = match Tag::read_from_path(&path) {
            Ok(t) => t,
            Err(e) => {
                let msg = format!("failed to read tags for {:?}: {}", path, e);
                log!(LogLevel::Err, "{}", &msg);
                return Err(msg.into());
            }
        };
        
        // title and artist are required
        let title = match tag.title() {
            Some(t) => t.to_string(),
            None => {
                let msg = format!("file {:?} missing title", path);
                log!(LogLevel::Err, "{}", &msg);
                return Err(msg.into());
            }
        };
        
        let artist = match tag.artist() {
            Some(a) => a.to_string(),
            None => {
                let msg = format!("file {:?} missing artist", path);
                log!(LogLevel::Err, "{}", &msg);
                return Err(msg.into());
            }
        };
        
        let mut cover_blob: Vec<u8> = Vec::new();
        
        if let Some(picture) = tag.pictures().find(|p| p.picture_type == PictureType::CoverFront) {
            let img = image::load_from_memory(&picture.data)?; 
            
            let t = img
                .resize_exact(128, 128, image::imageops::FilterType::Triangle)
                .into_rgb8();
            
            let mut cursor = Cursor::new(&mut cover_blob);
            t.write_to(&mut cursor, ImageFormat::Jpeg)?;
            
            let cover = img.resize_exact(512, 512, image::imageops::FilterType::Triangle).into_rgb8();
            
            if let Err(e) = self.save_cover(user, &cover, &title) {
                let msg = format!("failed to save cover error -> {}", e);
                log!(LogLevel::Err, "{}", &msg); 
                return Err(msg.into());
            };
        } else {
            let t = black_placeholder_cover(128);
            let mut cursor = Cursor::new(&mut cover_blob);
            t.write_to(&mut cursor, ImageFormat::Jpeg)?;
            
            if let Err(e) = self.save_cover(user, &black_placeholder_cover(512), &title) {
                let msg = format!("failed to save cover error -> {}", e);
                log!(LogLevel::Err, "{}", &msg); 
                return Err(msg.into());
            };
        };
        
        let cover_location = self.get_cover(&user, &title)
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or_default();
        
        // remove_embedded_pictures(&path).unwrap_or_else(|e| {
        //     log!(LogLevel::Err, "failed to remove embedded images from {:?}: {}", path, e);
        // });
        
        let album = tag.album().map(|s| s.to_string());
        let year = tag.year();
        
        let root_dir = self.get_root_dir();
        let relative_location = path.strip_prefix(&root_dir).unwrap();
        
        let cover_path = Path::new(&cover_location);
        let relative_cover = cover_path.strip_prefix(&root_dir).unwrap();
        
        let file_url = format!("/music/static/{}", relative_location.to_string_lossy().replace("\\", "/"));
        let cover_url = format!("/music/cover/{}", relative_cover.to_string_lossy().replace("\\", "/"));
        
        let row = MusicRow {
            id: None,
            userid: user.id.unwrap(),
            backend: StorageBackend::Local,
            location: file_url,
            cover_blob: Some(cover_blob),
            cover_location: cover_url,
            title,
            artist,
            album,
            year,
            date_added: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            size: path.metadata().map(|m| m.len() as i32).unwrap_or(0),
        };

        return Ok(row)
    }
    
    pub fn add_single_song(&self, username: &str, path: &str, conn: &DBPoolItem) -> AnyError<()> {
        let user = match UsersTable::get_by_username(username, conn)? {
            Some(s) => s,
            None => return Err("user doesn't exist".into())
        };

        let entry = self.parse_single_song(&user, path)?;

        log!(LogLevel::Debug, "applying row -> {}", &entry);
        MusicTable::insert(&entry, &conn);

        return Ok(())
    }

    pub fn propagate_db(&self, conn: &DBPoolItem) -> AnyError<Vec<MusicRow>> {
        let mut music_rows = Vec::new();
        let users = UsersTable::get_all(conn)?;

        for user in users {
            let user_dir = self.user_folder(&user.username);

            if !user_dir.exists() {
                continue;
            }

            for entry_res in fs::read_dir(user_dir)? {
                let entry = match entry_res {
                    Ok(e) => e,
                    Err(e) => {
                        log!(LogLevel::Err, "failed to read entry: {}", e);
                        continue;
                    }
                };
                
                let path = entry.path();
                
                // Skip directories
                if path.is_dir() {
                    continue;
                }
                
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with('.') {
                        continue;
                    }
                }
                
                let row = match self.parse_single_song(&user, path.to_str().unwrap()) {
                    Ok(r) => r,
                    Err(e) => {
                        log!(LogLevel::Err, "failed to parse song {}: {}", path.display(), e);
                        continue;
                    }
                };
                
                log!(LogLevel::Debug, "applying row -> {}", &row);
                
                if !MusicTable::insert(&row, conn) {
                    log!(LogLevel::Err, "failed to insert row");
                    continue;
                }
                
                music_rows.push(row);
            }
        }

        return Ok(music_rows)
    }
}

#[derive(Serialize)]
pub enum StorageBackend {
    Local,
    Remote(String)
}

impl StorageBackend {
    pub fn to_db_string(&self) -> String {
        match self {
            StorageBackend::Local => "local".to_string(),
            StorageBackend::Remote(url) => format!("remote:{}", url),
        }
    }

    pub fn from_db_string(s: &str) -> Self {
        if s == "local" {
            StorageBackend::Local
        } else if let Some(rest) = s.strip_prefix("remote:") {
            StorageBackend::Remote(rest.to_string())
        } else {
            StorageBackend::Local
        }
    }
}

// TABLES FROM HERE

#[derive(Serialize)]
pub struct MusicRow {
    pub id: Option<i32>,
    pub userid: i32,
    pub backend: StorageBackend,
    pub location: String,
    pub cover_blob: Option<Vec<u8>>,
    pub cover_location: String,
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub year: Option<i32>,
    pub date_added: u64,
    pub size: i32
}

impl MusicRow {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let backend_str: String = row.get(2)?;

        return Ok(Self {
            id: row.get(0)?,
            userid: row.get(1)?,
            backend: StorageBackend::from_db_string(&backend_str),
            location: row.get(3)?,
            cover_blob: row.get(4)?,
            cover_location: row.get(5)?,
            title: row.get(6)?,
            artist: row.get(7)?,
            album: row.get(8)?,
            year: row.get(9)?,
            date_added: row.get(10)?,
            size: row.get(11)?
        })
    }

    pub fn from_row_no_thumbnail(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        let backend_str: String = row.get(2)?;

        return Ok(Self {
            id: row.get(0)?,
            userid: row.get(1)?,
            backend: StorageBackend::from_db_string(&backend_str),
            location: row.get(3)?,
            cover_blob: None,
            cover_location: row.get(5)?,
            title: row.get(6)?,
            artist: row.get(7)?,
            album: row.get(8)?,
            year: row.get(9)?,
            date_added: row.get(10)?,
            size: row.get(11)?
        })
    }
}

impl fmt::Display for MusicRow {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "MusicRow {{ id: {:?}, userid: {}, backend: \"{}\", location: \"{}\", coverBlob: \"redacted for sanity reasons\", coverLocation, \"{}\", title: \"{}\", artist: \"{}\", album: \"{:?}\", year: {:?}, date_added: {}, size: {} }}",
            self.id, self.userid, self.backend.to_db_string(), self.location, self.cover_location, self.title, self.artist, self.album, self.year, self.date_added, self.size
        )
    }
}

pub struct MusicTable {}

impl MusicTable {
    pub fn insert(data: &MusicRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("INSERT INTO entry (userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)ON CONFLICT(userid, backend, location) DO NOTHING ",
                     (&data.userid, &data.backend.to_db_string(), &data.location, &data.cover_blob, &data.cover_location, &data.title, &data.artist, &data.album, &data.year, &data.date_added, &data.size));

        if let Err(err) = res {
            log!(LogLevel::Err, "insert user failed err -> {}", err);
            return false 
        }

        return true
    }

    pub fn replace(data: &MusicRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute(
            "INSERT OR REPLACE INTO entry (id, userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            (&data.id, &data.userid, &data.backend.to_db_string(), &data.location, &data.cover_blob, &data.cover_location, &data.title, &data.artist, &data.album, &data.year, &data.date_added, &data.size)
        );
        
        if let Err(err) = res {
            log!(LogLevel::Err, "replace user failed err -> {}", err);
            return false
        }
        
        return true
    }

    pub fn delete(row: &MusicRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("DELETE FROM entry WHERE url = ?1", [row.location.clone()]);

        if let Err(err) = res {
            log!(LogLevel::Err, "delete user failed err -> {}", err);
            return false;
        }

        return true;
    }

    pub fn get_by_user(userid: i32, conn: &DBPoolItem, with_thumbnail: bool) -> rusqlite::Result<Vec<MusicRow>> {
        let mut stmt: Statement;
        let rows: Vec<MusicRow>;

        if with_thumbnail {
            stmt = conn.prepare(
                "SELECT id, userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size
             FROM entry
             WHERE userid = ?1",
            )?;

            rows = stmt
                .query_map([userid], MusicRow::from_row)?
                .collect::<rusqlite::Result<Vec<MusicRow>>>()?;
        } else {
            stmt = conn.prepare(
                "SELECT id, userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size
             FROM entry
             WHERE userid = ?1",
            )?;

            rows = stmt
                .query_map([userid], MusicRow::from_row_no_thumbnail)?
                .collect::<rusqlite::Result<Vec<MusicRow>>>()?;
        }

        return Ok(rows)
    }

    pub fn get_by_id(id: i32, conn: &DBPoolItem) -> rusqlite::Result<Option<MusicRow>> {
        return conn.query_row(
            "SELECT id, userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size FROM entry WHERE id = ?1",
            [id],
            MusicRow::from_row,
        ).optional()
    }

    pub fn get_by_url(url: &str, conn: &DBPoolItem) -> rusqlite::Result<Option<MusicRow>> {
        return conn.query_row(
            "SELECT id, userid, backend, location, coverBlob, coverLocation, title, artist, album, year, dateAdded, size FROM entry WHERE url = ?1",
            [url],
            MusicRow::from_row,
        ).optional()
    }
}

#[derive(Serialize)]
pub struct UsersRow {
    pub id: Option<i32>,
    pub username: String,
    pub password: String,
    pub date_added: String,
}

impl UsersRow {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        return Ok(Self {
            id: row.get(0)?,
            username: row.get(1)?,
            password: row.get(2)?,
            date_added: row.get(3)?
        })
    }
}

impl fmt::Display for UsersRow {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "UsersRow {{ id: {:?}, username: \"{}\", password: \"{}\", date_added: {} }}",
            self.id, self.username, self.password, self.date_added
        )
    }
}

pub struct UsersTable {}

impl UsersTable {
    pub fn insert(data: &UsersRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("INSERT INTO OR IGNORE users (username, password, dateAdded) VALUES (?1, ?2, ?3)",
                     (&data.username, &data.password, &data.date_added));

        if let Err(err) = res {
            log!(LogLevel::Err, "insert user failed err -> {}", err);
            return false 
        }

        return true
    }

    pub fn replace(data: &UsersRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("INSERT OR REPLACE INTO users (id, username, password, dateAdded) VALUES (?1, ?2, ?3, ?4)",
                     (&data.id, &data.username, &data.password, &data.date_added));
        
        if let Err(err) = res {
            log!(LogLevel::Err, "replace user failed err -> {}", err);
            return false
        }
        
        return true
    }

    pub fn delete(row: &UsersRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("DELETE FROM users WHERE username = ?1", [row.username.clone()]);

        if let Err(err) = res {
            log!(LogLevel::Err, "delete user failed err -> {}", err);
            return false;
        }

        return true;
    }

    pub fn get_all(conn: &DBPoolItem) -> rusqlite::Result<Vec<UsersRow>> {
        let mut stmt = conn.prepare("SELECT id, username, password, dateAdded FROM users")?;
        let users_iter = stmt.query_map([], |row| UsersRow::from_row(row))?;

        let mut users = Vec::new();
        for user in users_iter {
            users.push(user?);
        }

        Ok(users)
    }

    pub fn get_by_id(id: i32, conn: &DBPoolItem) -> rusqlite::Result<Option<UsersRow>> {
        return conn.query_row(
            "SELECT id, username, password, dateAdded FROM entry WHERE id = ?1",
            [id],
            UsersRow::from_row,
        ).optional()
    }

    pub fn get_by_username(username: &str, conn: &DBPoolItem) -> rusqlite::Result<Option<UsersRow>> {
        return conn.query_row(
            "SELECT id, username, password, dateAdded FROM users WHERE username = ?1",
            [username],
            UsersRow::from_row,
        ).optional()
    }
}

#[derive(Serialize)]
pub struct PlaylistRow {
    pub id: Option<i32>,
    pub userid: i32,
    pub picture: Vec<u8>,
    pub title: String,
    pub date_added: u64, // or u64 if you store unix time
}

impl PlaylistRow {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            userid: row.get(1)?,
            picture: row.get(2)?,
            title: row.get(3)?,
            date_added: row.get(4)?,
        })
    }
}

pub struct PlaylistTable {}

impl PlaylistTable {
    pub fn insert(data: &PlaylistRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute(
            "INSERT INTO playlist (userid, picture, title, dateAdded) VALUES (?1, ?2, ?3, ?4)",
            (&data.userid, &data.picture, &data.title, &data.date_added),
        );

        if let Err(err) = res {
            log!(LogLevel::Err, "insert playlist failed -> {}", err);
            return false;
        }
        true
    }

    pub fn replace(data: &PlaylistRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute(
            "INSERT INTO OR REPLACE playlist (userid, picture, title, dateAdded) VALUES (?1, ?2, ?3, ?4)",
            (&data.userid, &data.picture, &data.title, &data.date_added),
        );

        if let Err(err) = res {
            log!(LogLevel::Err, "replace playlist failed -> {}", err);
            return false;
        }
        true
    }

    pub fn delete(row: &PlaylistRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("DELETE FROM playlist WHERE id = ?1", [row.id.clone()]);

        if let Err(err) = res {
            log!(LogLevel::Err, "delete user failed err -> {}", err);
            return false;
        }

        return true;
    }

    pub fn get_by_username(userid: i32, conn: &DBPoolItem) -> rusqlite::Result<Vec<PlaylistRow>> {
        let mut stmt = conn.prepare(
            "SELECT id, userid, picture, title, dateAdded FROM playlist WHERE userid = ?1",
        )?;
        let rows = stmt.query_map([userid], PlaylistRow::from_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn get_by_id(id: i32, conn: &DBPoolItem) -> rusqlite::Result<Option<PlaylistRow>> {
        conn.query_row(
            "SELECT id, userid, picture, title, dateAdded FROM playlist WHERE id = ?1",
            [id],
            PlaylistRow::from_row,
        ).optional()
    }
}


#[derive(Serialize)]
pub struct PlaylistEntryRow {
    pub id: Option<i32>,
    pub playlist_id: i32,
    pub entry_id: i32,
    pub date_added: u64,
    pub notes: Option<String>,
    pub pos: i32,
}

impl PlaylistEntryRow {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get(0)?,
            pos: row.get(1)?,
            playlist_id: row.get(2)?,
            entry_id: row.get(3)?,
            date_added: row.get(4)?,
            notes: row.get(5)?,
        })
    }
}

pub struct PlaylistEntryTable {}

impl PlaylistEntryTable {
    pub fn insert(data: &PlaylistEntryRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute(
            "INSERT INTO playlist_entry (pos, playlist_id, entry_id, dateAdded, notes) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &data.pos,
                &data.playlist_id,
                &data.entry_id,
                &data.date_added,
                &data.notes,
            ),
        );

        if let Err(err) = res {
            log!(LogLevel::Err, "insert playlist_entry failed -> {}", err);
            return false;
        }
        true
    }

    pub fn replace(data: &PlaylistEntryRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute(
            "INSERT INTO OR REPLACE playlist_entry (pos, playlist_id, entry_id, dateAdded, notes) 
             VALUES (?1, ?2, ?3, ?4, ?5)",
            (
                &data.pos,
                &data.playlist_id,
                &data.entry_id,
                &data.date_added,
                &data.notes,
            ),
        );

        if let Err(err) = res {
            log!(LogLevel::Err, "insert playlist_entry failed -> {}", err);
            return false;
        }
        true
    }

    pub fn delete(row: &PlaylistEntryRow, conn: &DBPoolItem) -> bool {
        let res = conn.execute("DELETE FROM playlist_entry WHERE id = ?1", [row.id.clone()]);

        if let Err(err) = res {
            log!(LogLevel::Err, "delete user failed err -> {}", err);
            return false;
        }

        return true;
    }

    pub fn get_by_id(id: i32, conn: &DBPoolItem) -> rusqlite::Result<Option<PlaylistEntryRow>> {
        return conn.query_row(
            "SELECT id, pos, playlist_id, entry_id, dateAdded, notes FROM playlist_entry WHERE id = ?1",
            [id], PlaylistEntryRow::from_row
        ).optional();
    }
 
    pub fn get_by_playlist(playlist_id: i32, conn: &DBPoolItem) -> rusqlite::Result<Vec<PlaylistEntryRow>> {
        let mut stmt = conn.prepare(
            "SELECT id, pos, playlist_id, entry_id, dateAdded, notes 
             FROM playlist_entry WHERE playlist_id = ?1 ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([playlist_id], PlaylistEntryRow::from_row)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }
}
