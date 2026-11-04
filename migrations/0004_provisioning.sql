-- Provisioning state for the Calagopus panel. NULL means not provisioned yet.
-- 'running' is a claim with a timestamp, so a crashed attempt can be retried
-- after the claim goes stale. Every step is resumable: the panel UUIDs are
-- stored as soon as they exist, and notification timestamps stop resends.
ALTER TABLE waitlist ADD COLUMN provision_state TEXT;
ALTER TABLE waitlist ADD COLUMN provision_started_at TEXT;
ALTER TABLE waitlist ADD COLUMN provision_error TEXT;
ALTER TABLE waitlist ADD COLUMN provision_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE waitlist ADD COLUMN calagopus_user_uuid TEXT;
ALTER TABLE waitlist ADD COLUMN server_uuid TEXT;
ALTER TABLE waitlist ADD COLUMN server_name TEXT;
ALTER TABLE waitlist ADD COLUMN dm_sent_at TEXT;
ALTER TABLE waitlist ADD COLUMN email_sent_at TEXT;
ALTER TABLE waitlist ADD COLUMN provisioned_at TEXT;

CREATE INDEX idx_waitlist_provision_state ON waitlist (provision_state, provision_started_at);
