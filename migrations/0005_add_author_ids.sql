-- Add author_id to wiki_pages
ALTER TABLE wiki_pages ADD COLUMN author_id INTEGER;

-- Recreate comments table to include author_id and link to users table
-- SQLite doesn't fully support ALTER TABLE for changing column types or adding foreign keys easily,
-- so we recreate the table.

-- 1. Rename the old comments table
ALTER TABLE comments RENAME TO _comments_old;

-- 2. Create the new comments table with author_id
CREATE TABLE comments (
    id INTEGER PRIMARY KEY NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    wiki_page_slug TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 3. (Optional) Copy data from the old table if needed.
-- In this case, we are starting fresh with user accounts, so we can skip this.

-- 4. Drop the old table
DROP TABLE _comments_old;
