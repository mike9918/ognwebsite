-- The waitlist card posted to the Discord ops channel. Keeping both ids means
-- provisioning edits the message the entry arrived with instead of posting a
-- second card, and a row created before this feature simply has nothing to edit.
ALTER TABLE waitlist ADD COLUMN discord_channel_id TEXT;
ALTER TABLE waitlist ADD COLUMN discord_message_id TEXT;
