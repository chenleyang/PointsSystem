CREATE TABLE IF NOT EXISTS shared_backup (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);
