CREATE TABLE entry (
    id INTEGER PRIMARY KEY,
    url       TEXT NOT NULL,
    title     TEXT NOT NULL,
    artist    TEXT NOT NULL,
    album     TEXT,
    year      INTEGER,
    dateAdded TEXT NOT NULL
);
