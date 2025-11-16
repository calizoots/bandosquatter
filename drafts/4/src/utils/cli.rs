use std::process::exit;
use std::env;

use crate::LogLevel;
use crate::log;

pub struct CliCommand {
    pub name: &'static str,
    pub description: &'static str,
    pub callback: Box<dyn Fn(Vec<String>) -> i32>,
}

#[allow(dead_code)]
impl CliCommand {
    fn run(&self, args: Vec<String>) -> i32 {
        (self.callback)(args)
    }
}

pub struct CliApp {
    name: String,
    args: Vec<String>,
    cmds: Vec<CliCommand>,
}

impl CliApp {
    pub fn init() -> CliApp {
        let mut a: Vec<String> = env::args().collect();
        let n = a.remove(0);

        return CliApp {
            name: n,
            args: a,
            cmds: Vec::new(),
        };
    }

    pub fn add(&mut self, cmd: CliCommand) {
        if self.cmds.iter().any(|c| c.name == cmd.name) {
            log!(LogLevel::Warn, "command '{}' already registered", cmd.name);
            return;
        }
        self.cmds.push(cmd);
    }

    fn check_cmds(&self) {
        if self.cmds.is_empty() {
            log!(LogLevel::Debug, "no cmds registered... like make your app do sumn");
            exit(96);
        } 
    }

    fn help(&self) {
        self.check_cmds();

        println!("usage: ./{} <command>", self.name);

        for cmd in &self.cmds {
            println!("    {}: {}", cmd.name, cmd.description)
        }

        println!("    help: print this help message");
    }

    pub fn run(&self) -> i32 {
        self.check_cmds();

        if self.args.is_empty() {
            log!(LogLevel::Err, "you have supplied no command");
            self.help();
            exit(69)
        }

        let cmd_name = &self.args[0];

        if cmd_name == "help" {
            self.help();
            return 0;
        }

        let cmd_args = self.args[1..].to_vec();

        if let Some(cmd) = self.cmds.iter().find(|c| c.name == *cmd_name) {
            return (cmd.callback)(cmd_args);
        }

        log!(LogLevel::Err, "unknown command: {}", cmd_name);
        self.help();
        return 2;
    }
}
