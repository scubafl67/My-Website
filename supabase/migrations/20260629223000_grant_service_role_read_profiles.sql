-- ingest-nerc verifies super-admin by reading profiles via the service role.
-- This project doesn't auto-grant DML to API roles, so the service role couldn't
-- read profiles -> the check failed -> 403 for everyone (including the real
-- super-admin). Grant the read so the ingest authorization check works.
grant select on table public.profiles to service_role;
