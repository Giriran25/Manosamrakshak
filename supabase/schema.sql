-- ---------------------------------------------------------------------------
-- ManoSamRakshak prototype - PostgreSQL / Supabase schema.
--
-- Mirrors the TypeScript entities in src/types. The application runs without
-- this: with no Supabase configuration present it uses the deterministic
-- in-memory dataset, and that is also the fallback if a configured backend is
-- unreachable.
--
-- This file contains NO secrets and NO seed personal data. Identity columns
-- live in their own table with their own policy, so that nothing in the
-- analytics path can join to them by accident.
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Enumerations
-- --------------------------------------------------------------------------
create type app_role          as enum ('victim', 'counsellor', 'admin');
create type channel           as enum ('chat', 'voice', 'ivrs', 'sms');
create type case_stage        as enum ('fir', 'investigation', 'chargesheet', 'trial', 'post_trial', 'rehabilitation');
create type risk_band         as enum ('stable', 'watch', 'elevated', 'high');
create type trend_state       as enum ('stable', 'improving', 'watch', 'deteriorating', 'rapid_deterioration', 'persistent_high');
create type followup_cadence  as enum ('monthly', 'fortnightly', 'weekly', 'within_72h', 'within_48h', 'within_24h');
create type identity_purpose  as enum ('counselling_outreach', 'protection_request', 'relief_escalation', 'medical_referral');

create type case_event_type as enum (
  'fir_registered', 'relief_due', 'relief_delayed', 'relief_instalment_received',
  'chargesheet_pending', 'chargesheet_filed', 'bail_hearing_scheduled',
  'accused_released_on_bail', 'hearing_scheduled', 'hearing_postponed',
  'repeated_adjournment', 'witness_intimidation_reported', 'trial_commenced',
  'acquittal', 'protection_requested', 'rehabilitation_started'
);

create type counsellor_action_kind as enum (
  'reviewed', 'confirmed_concern', 'dismissed', 'escalated',
  'counsellor_requested', 'relief_escalation_requested'
);

create type audit_action as enum (
  'session_started', 'safety_override', 'counsellor_action', 'followup_changed',
  'identity_access_requested', 'identity_access_granted', 'identity_access_expired',
  'consent_changed', 'interaction_recorded', 'data_source_selected'
);

-- --------------------------------------------------------------------------
-- Districts and users
-- --------------------------------------------------------------------------
create table districts (
  id    text primary key,
  name  text not null
);

create table users (
  id            uuid primary key default gen_random_uuid(),
  role          app_role not null,
  display_label text not null,
  district_id   text not null references districts (id),
  created_at    timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Cases. The pseudonymous reference is the key used everywhere in analytics.
-- No name, address or contact number appears on this table by design.
-- --------------------------------------------------------------------------
create table cases (
  id                   uuid primary key default gen_random_uuid(),
  case_ref             text not null unique,
  district_id          text not null references districts (id),
  stage                case_stage not null,
  opened_at            timestamptz not null,
  last_interaction_at  timestamptz,
  missed_checkins      integer not null default 0,
  consent_chat         boolean not null default true,
  consent_voice        boolean not null default true,
  consent_ivrs         boolean not null default true,
  consent_sms          boolean not null default true,
  consent_passive      boolean not null default true,
  consent_updated_at   timestamptz not null default now(),
  is_synthetic         boolean not null default false,
  notes                text,
  created_at           timestamptz not null default now()
);

create index cases_district_idx on cases (district_id, stage);

-- --------------------------------------------------------------------------
-- Identity vault. Separate table, separate policy, never selected alongside
-- case data. Reads are expected to go through an audited server-side path.
-- --------------------------------------------------------------------------
create table case_identities (
  case_id     uuid primary key references cases (id) on delete cascade,
  full_name   text not null,
  location    text not null,
  contact     text not null,
  updated_at  timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Case events - Stream A, the statutory calendar.
-- --------------------------------------------------------------------------
create table case_events (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases (id) on delete cascade,
  type            case_event_type not null,
  occurred_at     timestamptz not null,
  statutory_note  text,
  detail          text,
  created_at      timestamptz not null default now()
);

create index case_events_case_idx on case_events (case_id, occurred_at desc);

-- --------------------------------------------------------------------------
-- Check-ins and the normalized interaction record every channel produces.
-- --------------------------------------------------------------------------
create table checkins (
  id           uuid primary key default gen_random_uuid(),
  case_id      uuid not null references cases (id) on delete cascade,
  scheduled_at timestamptz,
  completed_at timestamptz,
  cadence      followup_cadence not null default 'monthly',
  created_at   timestamptz not null default now()
);

create table interaction_events (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references cases (id) on delete cascade,
  channel       channel not null,
  started_at    timestamptz not null,
  completed_at  timestamptz,
  completion    text not null check (completion in ('complete', 'partial', 'abandoned')),
  -- Structured answers and optional free text. Raw audio is never stored:
  -- features are extracted at ingest and the audio is discarded there.
  responses     jsonb not null default '[]'::jsonb,
  latency_ms    integer not null default 0,
  text_length   integer not null default 0,
  confidence    integer not null default 0,
  is_synthetic  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index interaction_events_case_idx on interaction_events (case_id, started_at desc);

create table signal_features (
  interaction_id      uuid primary key references interaction_events (id) on delete cascade,
  text_distress       integer,
  behaviour_distress  integer,
  voice_signal        integer,
  composite_raw       integer,
  emotion             text,
  crisis_flag         boolean not null default false,
  -- Category only. The sentence that triggered an override is never stored.
  crisis_category     text,
  -- Summary voice measures only.
  voice_duration_ms   integer,
  voice_mean_energy   numeric(6, 4),
  voice_energy_var    numeric(6, 4),
  voice_pause_ratio   numeric(6, 4),
  voice_speak_ratio   numeric(6, 4)
);

-- --------------------------------------------------------------------------
-- Derived state.
-- --------------------------------------------------------------------------
create table baseline_profiles (
  case_id           uuid primary key references cases (id) on delete cascade,
  status            text not null check (status in ('establishing', 'established')),
  interactions_used integer not null default 0,
  distress          integer,
  latency_ms        integer,
  text_length       integer,
  checkin_gap_days  integer,
  updated_at        timestamptz
);

create table risk_scores (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases (id) on delete cascade,
  computed_at     timestamptz not null default now(),
  distress_score  integer not null check (distress_score between 0 and 100),
  band            risk_band not null,
  escalation_14d  integer not null check (escalation_14d between 0 and 100),
  baseline        integer,
  deviation       integer,
  trend           trend_state not null,
  slope           numeric(6, 2) not null default 0,
  confidence      integer not null check (confidence between 0 and 100),
  contributions   jsonb not null default '[]'::jsonb,
  factors         jsonb not null default '[]'::jsonb,
  safety_override boolean not null default false
);

create index risk_scores_case_idx on risk_scores (case_id, computed_at desc);

create table followups (
  case_id     uuid primary key references cases (id) on delete cascade,
  cadence     followup_cadence not null,
  due_at      timestamptz not null,
  changed_at  timestamptz not null default now(),
  changed_by  text not null,
  reason      text not null
);

create table counsellor_actions (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases (id) on delete cascade,
  kind        counsellor_action_kind not null,
  actor_role  app_role not null,
  actor_id    uuid references users (id),
  route       text,
  -- Case note. Deliberately NOT copied into audit_logs.
  note        text,
  created_at  timestamptz not null default now()
);

create index counsellor_actions_case_idx on counsellor_actions (case_id, created_at desc);

-- --------------------------------------------------------------------------
-- Identity access requests and the audit trail.
-- --------------------------------------------------------------------------
create table identity_access_requests (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references cases (id) on delete cascade,
  requested_by    uuid references users (id),
  requester_role  app_role not null,
  purpose         identity_purpose not null,
  reason          text not null,
  revealed_fields text[] not null,
  requested_at    timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index identity_requests_case_idx on identity_access_requests (case_id, requested_at desc);

-- Purpose codes and outcomes only: no names, no free text, no transcripts,
-- no audio, and no sentence from a check-in.
create table audit_logs (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_role  text not null,
  action      audit_action not null,
  subject     text not null,
  outcome     text not null
);

create index audit_logs_time_idx on audit_logs (occurred_at desc);

-- --------------------------------------------------------------------------
-- Row-level security. Policy sketches: district scoping for staff, own-case
-- access for a person receiving support, and an identity vault that no
-- ordinary role can read at all.
-- --------------------------------------------------------------------------
alter table cases                    enable row level security;
alter table case_events              enable row level security;
alter table interaction_events       enable row level security;
alter table signal_features          enable row level security;
alter table baseline_profiles        enable row level security;
alter table risk_scores              enable row level security;
alter table followups                enable row level security;
alter table counsellor_actions       enable row level security;
alter table identity_access_requests enable row level security;
alter table audit_logs               enable row level security;
alter table case_identities          enable row level security;

-- Staff see only their own district.
create policy cases_district_read on cases
  for select using (
    district_id = (
      select district_id from users where users.id = auth.uid()
    )
  );

create policy case_events_district_read on case_events
  for select using (
    exists (
      select 1
      from cases
      join users on users.id = auth.uid()
      where cases.id = case_events.case_id
        and cases.district_id = users.district_id
    )
  );

-- The identity vault has no select policy for ordinary roles. Reads go
-- through an audited server-side function that records the purpose and the
-- fields released before returning anything.
create policy identities_no_direct_read on case_identities
  for select using (false);

-- Audit entries are append-only from the application's point of view.
create policy audit_insert_only on audit_logs for insert with check (true);
