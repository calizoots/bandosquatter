# bandosquatter

A cool way to play your music... it is easy to use... easy to setup... easy to run
> This is the rewrite the old bandosquatter is at drafts/1

This rewrite is not finished yet but is written a lot better than the last
<br>
Some of the new feautres:
- Rust (performance mainly)
- It will have everything it had before!
- Small UI rework and works better on mobiles

## Screenshots

[here](https://github.com/calizoots/bandosquatter/blob/staging/Screenshots.md)

## Getting Started

First make sure you have rust installed & cargo.
```
git clone https://github.com/calizoots/bandosquatter.git
cd bandosquatter
cargo run start
```
This will start the UI on `http://localhost:8080` and the api on `http://localhost:3000`
<br>
The logs are at your temporary directory /bandosquatter/bq.out.log & bq.err.log
<br>
Your database will be in your AppData or equivelent (Application Support) /com.cali.bandosquatter/db.sqlite
<br>
Default username & password is

user: bine
<br>
password: giveoutbinedaily

Then to turn off
```
cargo run stop
```

### note

made with lots of love - s.c <3
