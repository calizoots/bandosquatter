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
