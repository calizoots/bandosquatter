use chrono::Local;

pub type AnyError<T> = Result<T, Box<dyn std::error::Error>>;

#[allow(dead_code)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Err,
    Warn,
    Debug,
}

impl LogLevel {
    pub fn resolve_message(&self) -> String {
        let time = Local::now().format("%Y-%m-%d %H:%M:%S");
        let label = match self {
            LogLevel::Info => "[info]",
            LogLevel::Err => "[error]",
            LogLevel::Warn => "[warning]",
            LogLevel::Debug => "[debug]",
        };
        format!("{} {}", time, label)
    }
}

#[macro_export]
macro_rules! log {
    ($level:expr, $($arg:tt)*) => ({
        if matches!($level, $crate::logger::LogLevel::Debug) && !cfg!(debug_assertions) {
            // skip debug logs in release mode
        } else {
            print!("{} ", $level.resolve_message());
            println!($($arg)*);
        }
    })
}
