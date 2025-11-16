CREATE TABLE IF NOT EXISTS playlist (
       id                INTEGER PRIMARY KEY,
       userid            INTEGER NOT NULL,
       picture           BLOB NOT NULL,
       title             TEXT NOT NULL,
       dateAdded         INTEGER NOT NULL,
       FOREIGN key(userid) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS playlist_entry (
    id          INTEGER PRIMARY KEY,
    pos         INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    entry_id    INTEGER NOT NULL,
    dateAdded   INTEGER NOT NULL,
    notes       TEXT,

    FOREIGN KEY (playlist_id) REFERENCES playlist(id) ON DELETE CASCADE,
    FOREIGN KEY (entry_id) REFERENCES entry(id) ON DELETE CASCADE,

    UNIQUE (playlist_id, entry_id) -- prevent duplicate songs in same playlist
);
