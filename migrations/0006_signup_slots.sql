-- Open sign-ups count a free slot as a row that is queued, being provisioned or
-- done. Legacy waitlist rows (provision_state IS NULL) and failed rows do not
-- hold a slot, so a hard failure never silently eats capacity.
--
-- No row is rewritten here: every existing row keeps its state, and the cap only
-- starts counting a legacy row once an admin provisions it.
CREATE INDEX idx_waitlist_occupancy ON waitlist (provision_state)
  WHERE provision_state IN ('queued', 'running', 'done');
