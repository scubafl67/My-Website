-- Training tables for CIPGuard AI Trainer integration
-- Links to existing profiles table via user_id (auth.users FK)

-- ─── Training Profiles (IQ tracking, baseline state) ────────────────────────
create table public.training_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  domain text not null default 'nerc_cip',
  iq_score float not null default 0.0,
  iq_per_standard jsonb not null default '{}'::jsonb,
  iq_history jsonb not null default '[]'::jsonb,
  strengths jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  interaction_count int not null default 0,
  pattern_data jsonb not null default '{}'::jsonb,
  baseline_completed int not null default 0,
  escalation_contact text not null default '',
  confidence_per_standard jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  last_interaction timestamptz not null default now()
);

comment on table public.training_profiles is
  'Per-user AI Trainer state — IQ scores, baseline status, strengths/gaps. 1:1 with auth.users.';

create or replace function public.handle_training_profile_updated()
returns trigger language plpgsql as $$
begin
  new.last_interaction = now();
  return new;
end;
$$;

create trigger training_profiles_set_updated
  before update on public.training_profiles
  for each row execute function public.handle_training_profile_updated();

alter table public.training_profiles enable row level security;

create policy "Users can view own training profile"
  on public.training_profiles for select using (auth.uid() = user_id);

create policy "Users can insert own training profile"
  on public.training_profiles for insert with check (auth.uid() = user_id);

create policy "Users can update own training profile"
  on public.training_profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Service role needs full access for the FastAPI backend
create policy "Service role full access on training_profiles"
  on public.training_profiles for all
  to service_role using (true) with check (true);

-- ─── Training Interactions (per-exchange log) ────────────────────────────────
create table public.training_interactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null default 'nerc_cip',
  timestamp timestamptz not null default now(),
  topic_standard text,
  question_summary text,
  option_chosen text,
  reasoning_quality text,
  iq_delta float default 0.0,
  source_used text,
  source_type text default '',
  source_detail text default '',
  standard_cited text default '',
  reasoning_depth text default '',
  cross_standard_awareness int default 0,
  missed_implications jsonb default '[]'::jsonb,
  comprehension_confirmed int default 0,
  comprehension_attempts int default 0
);

comment on table public.training_interactions is
  'Per-exchange interaction log for AI Trainer sessions — reasoning, sources, IQ deltas.';

create index training_interactions_user_id_idx
  on public.training_interactions (user_id);

create index training_interactions_timestamp_idx
  on public.training_interactions (timestamp desc);

alter table public.training_interactions enable row level security;

create policy "Users can view own interactions"
  on public.training_interactions for select using (auth.uid() = user_id);

create policy "Users can insert own interactions"
  on public.training_interactions for insert with check (auth.uid() = user_id);

create policy "Service role full access on training_interactions"
  on public.training_interactions for all
  to service_role using (true) with check (true);

-- ─── Training Conversation History (persists chat across sessions) ───────────
create table public.training_conversations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

comment on table public.training_conversations is
  'Persistent conversation history for AI Trainer — allows session continuity.';

create index training_conversations_user_id_idx
  on public.training_conversations (user_id, created_at);

alter table public.training_conversations enable row level security;

create policy "Users can view own conversations"
  on public.training_conversations for select using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on public.training_conversations for insert with check (auth.uid() = user_id);

create policy "Service role full access on training_conversations"
  on public.training_conversations for all
  to service_role using (true) with check (true);

-- ─── Source Attribution Logs ─────────────────────────────────────────────────
create table public.training_source_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_summary text not null,
  source_type text not null,
  source_detail text not null default '',
  standard_cited text default '',
  tool_used text default '',
  confidence float default 0.0,
  created_at timestamptz not null default now()
);

create index training_source_logs_user_id_idx
  on public.training_source_logs (user_id);

alter table public.training_source_logs enable row level security;

create policy "Users can view own source logs"
  on public.training_source_logs for select using (auth.uid() = user_id);

create policy "Service role full access on training_source_logs"
  on public.training_source_logs for all
  to service_role using (true) with check (true);

-- ─── Reasoning Journal Logs ──────────────────────────────────────────────────
create table public.training_reasoning_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  standard_id text not null,
  requirement_id text default '',
  options_presented jsonb not null default '[]'::jsonb,
  option_chosen text not null,
  reasoning_given text not null default '',
  ai_assessment text not null default '',
  reasoning_depth text default 'surface',
  cross_standard_awareness boolean default false,
  missed_implications jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index training_reasoning_logs_user_id_idx
  on public.training_reasoning_logs (user_id);

alter table public.training_reasoning_logs enable row level security;

create policy "Users can view own reasoning logs"
  on public.training_reasoning_logs for select using (auth.uid() = user_id);

create policy "Service role full access on training_reasoning_logs"
  on public.training_reasoning_logs for all
  to service_role using (true) with check (true);

-- ─── Escalation Logs ─────────────────────────────────────────────────────────
create table public.training_escalations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question text not null,
  tier1_result text not null default '',
  tier2_result text not null default '',
  escalation_contact text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index training_escalations_user_id_idx
  on public.training_escalations (user_id);

alter table public.training_escalations enable row level security;

create policy "Users can view own escalations"
  on public.training_escalations for select using (auth.uid() = user_id);

create policy "Service role full access on training_escalations"
  on public.training_escalations for all
  to service_role using (true) with check (true);

-- ─── Comprehension Tracking ──────────────────────────────────────────────────
create table public.training_comprehension (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  standard_id text not null,
  topic text not null default '',
  failure_count int not null default 0,
  mode text not null default 'normal',
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, standard_id, topic)
);

create index training_comprehension_user_id_idx
  on public.training_comprehension (user_id);

alter table public.training_comprehension enable row level security;

create policy "Users can view own comprehension"
  on public.training_comprehension for select using (auth.uid() = user_id);

create policy "Service role full access on training_comprehension"
  on public.training_comprehension for all
  to service_role using (true) with check (true);
