-- NULL means a legacy signup has not completed the new join/notification flow.
ALTER TABLE waitlist ADD COLUMN discord_joined_at TEXT;
ALTER TABLE waitlist ADD COLUMN discord_dm_consent_at TEXT;
