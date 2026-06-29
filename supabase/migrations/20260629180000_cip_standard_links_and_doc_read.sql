-- Links shown on each CIP Standards tile
alter table public.cip_standards
  add column nerc_url text,
  add column technical_rationale_url text;

-- Official NERC standard PDF (NERC redirects this path to the current PDF)
update public.cip_standards
  set nerc_url = 'https://www.nerc.com/pa/Stand/Reliability%20Standards/' || id || '.pdf';

-- Allow signed-in users to read the official standard texts so the UI can show
-- the requirement (R1/R2/...) language when a user clicks a requirement badge.
-- Scoped to official standard texts only (public reference material).
create policy "Authenticated can read official standard texts"
  on public.nerc_documents for select
  to authenticated
  using (metadata->>'kind' = 'official-standard-text');
