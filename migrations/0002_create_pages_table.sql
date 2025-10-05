-- Migration number: 0002
CREATE TABLE IF NOT EXISTS pages (
    slug TEXT PRIMARY KEY NOT NULL,
    content TEXT NOT NULL
);
