-- Create the FIRST Website Owner (run once, later, during setup)
--
-- Step 1: Supabase > Authentication > Users > Add user > Create new user
--         (type your own email + a strong password, tick "Auto Confirm User")
-- Step 2: Supabase > SQL Editor > New query
--         Replace YOUR-OWNER-EMAIL below with that same email, then Run.
--
-- Do NOT put your real email in this GitHub file. Edit it only inside
-- the Supabase SQL Editor.

insert into profiles (id, email, full_name, role, status)
select id, email, 'Owner', 'owner', 'approved'
from auth.users
where email = 'YOUR-OWNER-EMAIL'
on conflict (id) do update
  set role = 'owner', status = 'approved';
