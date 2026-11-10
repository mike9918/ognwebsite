-- Open sign-ups launch with 25 free slots. The value is stored, not a schema
-- default, so staff can change or clear it in Admin -> Sign-up controls without
-- a deploy. Only an unset cap is filled in; a cap someone already chose stays.
UPDATE waitlist_settings SET signup_cap = 25 WHERE signup_cap IS NULL;
