use std::env;
use std::fs::{File, read_to_string, remove_file};
use std::path::{Path, PathBuf};
use std::io::Write;
use std::process::{Command, Stdio, exit};

use directories::ProjectDirs;
use once_cell::sync::Lazy;
use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;
use chrono::Local;

use crate::{log, logger::*};

const APP_PORT: u16 = 8080;
const API_PORT: u16 = 3000;

static TMP_DIR: Lazy<PathBuf> = Lazy::new(|| {
    // explicit override via env var
    if let Ok(p) = env::var("BINE_TMP_DIR") {
        return PathBuf::from(p);
    }

    // if compiling in debug prefer /tmp for easy manual inspection
    if cfg!(debug_assertions) {
        return PathBuf::from("/tmp/bandosquatter");
    }

    // production use the system temporary dir and add an app-specific subdir
    let mut d = env::temp_dir();
    d.push("bandosquatter");
    return d
});

struct BqOutConfig {
    pid: PathBuf,
    out: PathBuf,
    err: PathBuf,
}

static FILES: Lazy<BqOutConfig> = Lazy::new(|| BqOutConfig {
    pid: TMP_DIR.join("b.pid"),
    out: TMP_DIR.join("bq.out.log"),
    err: TMP_DIR.join("bq.err.log"),
});

static APP_DIR: Lazy<ProjectDirs> = Lazy::new(|| {
    return ProjectDirs::from("com", "cali", "bandosquatter")
        .expect("cannot determine data directory");
});

static DATA_DIR: Lazy<PathBuf> = Lazy::new(|| {
    return APP_DIR.data_dir().into()
});

static DB_PATH: Lazy<PathBuf> = Lazy::new(|| {
    return DATA_DIR.join("db.sqlite")
});

fn ensure_dir(p: &Path) -> AnyError<()> {
    if p.is_file() {
        return Err(format!("expected dir but found file at {}", p.display()).into());
    }

    if !p.exists() {
        std::fs::create_dir_all(p)?; // use create_dir_all so parents are made too
    }

    Ok(())
}

fn check_config_dirs() -> AnyError<()> {
    ensure_dir(&*TMP_DIR)?;
    ensure_dir(&*DATA_DIR)?;
    Ok(())
}

const CHILD_ENV_VAR: &str = "BINE_CHILD_PROCESS";

pub fn check_is_child() {
    if let Err(e) = check_config_dirs() {
        log!(LogLevel::Err, "failed to create the data dirs for data error (exiting) -> {}", e);
        exit(69);
    }

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

fn child_work() {
    todo!("child_work aint done yet")
}

pub fn start_daemon(_args: Vec<String>) -> i32 {
    if FILES.pid.as_path().exists() {
        log!(LogLevel::Err, "process is already running pid file at {}", FILES.pid.display());
        return 1
    }

    let exe = match env::current_exe() {
        Ok(s) => s,
        Err(e) => {
            log!(LogLevel::Err, "failed to get the current exe path: {}", e);
            return 1
        }
    };

    let dout_file = File::create(FILES.out.as_path());
    let derr_file = File::create(FILES.err.as_path());

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

    let mut pidfile = match File::create(FILES.pid.as_path()) {
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

fn remove_pid_file() {
    if let Err(e) = remove_file(FILES.pid.as_path()) {
        log!(LogLevel::Err, "failed to remove pid file: {}", e);
    }
}

pub fn stop_daemon(_args: Vec<String>) -> i32 {
    if !FILES.pid.as_path().exists() {
        log!(LogLevel::Err, "pid file does not exist daemon probably isnt running.");
        return 1
    }

    let pid_str = match read_to_string(FILES.pid.as_path()) {
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
        remove_pid_file();
        return 1;
    }

    remove_pid_file();

    log!(LogLevel::Info, "successfully stopped background process with pid {}", pid);

    return 0
}
