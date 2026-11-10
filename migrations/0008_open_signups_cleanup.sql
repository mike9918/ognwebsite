-- Finish the open-sign-ups cutover:
-- 1) Drop leftover waitlist-era rows that never entered provisioning.
-- 2) Store Automatic / Manual provisioning as an admin setting (AUD-66).
--
-- Failed rows still do not hold a free slot; new sign-ups always write
-- provision_state = 'queued', so NULL rows should not reappear.
DELETE FROM waitlist WHERE provision_state IS NULL;

ALTER TABLE waitlist_settings ADD COLUMN auto_provision INTEGER NOT NULL DEFAULT 0;
