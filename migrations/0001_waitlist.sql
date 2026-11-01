CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  run_type TEXT NOT NULL CHECK (run_type IN ('vanilla', 'plugins', 'modpack')),
  run_detail TEXT,
  is_13_plus INTEGER NOT NULL CHECK (is_13_plus = 1),
  ref_code TEXT NOT NULL UNIQUE,
  referred_by TEXT,
  referral_count INTEGER NOT NULL DEFAULT 0,
  ip_hash TEXT NOT NULL,
  country TEXT,
  created_at TEXT NOT NULL,
  invited_at TEXT,
  wave INTEGER
);

CREATE INDEX idx_waitlist_created ON waitlist (created_at, id);

CREATE TABLE signup_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_signup_attempts_ip_created ON signup_attempts (ip_hash, created_at);
