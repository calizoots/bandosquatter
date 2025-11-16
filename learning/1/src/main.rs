mod cli;
mod logger;
mod background;

use cli::{CliApp, CliCommand};
use background::{check_is_child, start_daemon, stop_daemon};

use crate::logger::*;

fn main() {
    check_is_child();

    // let password_hash = generate_hash("giveoutbinedaily");
    // println!("{}", password_hash);
    // let parsed_hash = PasswordHash::new(&password_hash).unwrap();
    // assert!(Argon2::default().verify_password("giveoutbinedaily".as_bytes(), &parsed_hash).is_ok());

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
