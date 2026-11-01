CREATE TABLE waitlist_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  signup_cap INTEGER CHECK (signup_cap IS NULL OR signup_cap >= 0),
  updated_at TEXT NOT NULL
);

INSERT INTO waitlist_settings (id, is_open, signup_cap, updated_at)
VALUES (1, 1, NULL, '1970-01-01T00:00:00.000Z');
