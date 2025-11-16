mod utils;
mod background;
mod server;

use crate::utils::cli::{CliApp, CliCommand};
use crate::background::{check_is_child, start_daemon, stop_daemon};
use crate::utils::log::LogLevel;

fn main() {
    check_is_child();

    let mut cli = CliApp::init();

    cli.add(CliCommand {
        name: "start",
        description: "starts daemon",
        callback: Box::new(start_daemon)
    });

    cli.add(CliCommand {
        name: "stop",
        description: "stops daemon",
        callback: Box::new(stop_daemon)
    });

    cli.add(CliCommand {
        name: "restart",
        description: "restarts daemon",
        callback: Box::new(|args: Vec<String>| {
            stop_daemon(args.clone());
            start_daemon(args.clone());
            return 0;
        }),
    });

    cli.run();
}
