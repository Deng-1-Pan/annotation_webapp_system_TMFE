-- TMFE Annotation Webapp schema (Supabase/Postgres)
-- Designed for: GitHub Pages frontend + Supabase shared persistence

create extension if not exists pgcrypto;

create table if not exists app_users (
  id text primary key,
  display_name text not null unique,
  is_test_user boolean not null default false,
  can_adjudicate boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists task_configs (
  task_type text primary key,
  display_name text not null,
  description text not null,
  target_total_completed integer not null,
  target_min_per_label integer,
  coverage_labels_json jsonb,
  exclude_test_by_default boolean not null default true,
  batch_strategy text not null default 'auto_mixed',
  batch_ratio numeric,
  updated_at timestamptz not null default now()
);

create table if not exists task_items (
  id text primary key,
  task_type text not null,
  sample_id text not null,
  doc_id text not null,
  payload_json jsonb not null,
  source_row_json jsonb,
  created_at timestamptz not null default now(),
  unique (task_type, sample_id)
);
create index if not exists idx_task_items_task on task_items(task_type);
create index if not exists idx_task_items_doc on task_items(doc_id);

create table if not exists transcript_docs (
  doc_id text primary key,
  ticker text,
  year integer,
  quarter integer,
  source_date text,
  speech_turns_json jsonb not null default '[]'::jsonb,
  qa_turns_json jsonb not null default '[]'::jsonb,
  merged_turns_json jsonb not null default '[]'::jsonb,
  meta_json jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists claims (
  id text primary key,
  batch_id text not null,
  task_type text not null,
  sample_id text not null,
  user_id text not null references app_users(id),
  mode text not null check (mode in ('annotator', 'test', 'adjudicator')),
  status text not null check (status in ('claimed','submitted','expired','released')),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_claims_batch on claims(batch_id);
create index if not exists idx_claims_task_status on claims(task_type, status, expires_at);

create table if not exists annotations (
  id text primary key,
  task_type text not null,
  sample_id text not null,
  user_id text not null references app_users(id),
  mode text not null check (mode in ('annotator', 'test')),
  annotation_json jsonb not null,
  notes text,
  source_claim_id text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (task_type, sample_id, user_id, mode)
);
create index if not exists idx_annotations_task_sample on annotations(task_type, sample_id);
create index if not exists idx_annotations_user on annotations(user_id, submitted_at desc);

create table if not exists adjudications (
  id text primary key,
  task_type text not null,
  sample_id text not null,
  adjudicated_json jsonb not null,
  adjudication_notes text,
  adjudicated_by text not null references app_users(id),
  adjudicated_at timestamptz not null default now(),
  auto_filled boolean not null default false,
  unique (task_type, sample_id)
);
create index if not exists idx_adjudications_task_sample on adjudications(task_type, sample_id);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  task_type text,
  sample_id text,
  actor_user_id text,
  payload_json jsonb,
  created_at timestamptz not null default now()
);

-- Demo-friendly open policies (tighten for production)
alter table app_users enable row level security;
alter table task_configs enable row level security;
alter table task_items enable row level security;
alter table transcript_docs enable row level security;
alter table claims enable row level security;
alter table annotations enable row level security;
alter table adjudications enable row level security;
alter table audit_events enable row level security;

drop policy if exists app_users_all on app_users;
create policy app_users_all on app_users for all using (true) with check (true);
drop policy if exists task_configs_all on task_configs;
create policy task_configs_all on task_configs for all using (true) with check (true);
drop policy if exists task_items_all on task_items;
create policy task_items_all on task_items for all using (true) with check (true);
drop policy if exists transcript_docs_all on transcript_docs;
create policy transcript_docs_all on transcript_docs for all using (true) with check (true);
drop policy if exists claims_all on claims;
create policy claims_all on claims for all using (true) with check (true);
drop policy if exists annotations_all on annotations;
create policy annotations_all on annotations for all using (true) with check (true);
drop policy if exists adjudications_all on adjudications;
create policy adjudications_all on adjudications for all using (true) with check (true);
drop policy if exists audit_events_all on audit_events;
create policy audit_events_all on audit_events for all using (true) with check (true);

-- Progress base view (formal annotations only)
create or replace view task_item_annotation_state_v as
with formal as (
  select task_type, sample_id, count(distinct user_id) as formal_annotator_count
  from annotations
  where mode = 'annotator'
  group by task_type, sample_id
),
claim_active as (
  select task_type, sample_id, count(*) as active_claim_count
  from claims
  where status = 'claimed' and expires_at > now()
  group by task_type, sample_id
),
adj as (
  select task_type, sample_id, 1 as has_adjudication
  from adjudications
)
select
  ti.task_type,
  ti.sample_id,
  ti.doc_id,
  coalesce(f.formal_annotator_count, 0) as formal_annotator_count,
  (coalesce(f.formal_annotator_count, 0) >= 1) as is_single_annotated,
  (coalesce(f.formal_annotator_count, 0) >= 2) as is_double_annotated,
  (coalesce(f.formal_annotator_count, 0) = 1) as is_single_only,
  (coalesce(f.formal_annotator_count, 0) = 0) as is_zero_annotated,
  coalesce(c.active_claim_count, 0) as active_claim_count,
  (coalesce(a.has_adjudication, 0) = 1) as is_adjudicated
from task_items ti
left join formal f on f.task_type = ti.task_type and f.sample_id = ti.sample_id
left join claim_active c on c.task_type = ti.task_type and c.sample_id = ti.sample_id
left join adj a on a.task_type = ti.task_type and a.sample_id = ti.sample_id;

create or replace view task_progress_summary_v as
select
  t.task_type,
  count(*) as total_items,
  count(*) filter (where is_single_annotated) as single_annotated_count,
  count(*) filter (where is_double_annotated) as double_annotated_count,
  count(*) filter (where is_adjudicated) as adjudicated_count,
  count(*) filter (where is_single_only) as single_only_count,
  count(*) filter (where is_zero_annotated) as zero_annotated_count,
  coalesce(sum(active_claim_count), 0) as in_progress_count
from task_item_annotation_state_v t
group by t.task_type;

-- Optional utility for expiring stale claims
create or replace function expire_stale_claims()
returns integer
language plpgsql
as $$
declare
  updated_count integer;
begin
  update claims
  set status = 'expired'
  where status = 'claimed' and expires_at <= now();
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
