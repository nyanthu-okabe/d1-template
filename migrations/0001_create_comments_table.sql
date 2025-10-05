-- Migration number: 0001 	 2024-12-27T22:04:18.794Z
DROP TABLE IF EXISTS comments;
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    wiki_page_slug TEXT NOT NULL
);

-- Insert some sample data into our comments table.
INSERT INTO comments (author, content, wiki_page_slug)
VALUES
    ('Kristian', 'Congrats!', 'hello'),
    ('Serena', 'Great job!', 'hello'),
    ('Max', 'Keep up the good work!', 'another-page');