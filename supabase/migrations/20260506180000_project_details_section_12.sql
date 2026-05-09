-- Initial schema from docs/project_details.md §12 (Database Schema).
-- SQL below matches §12.1–§12.6; trailing indexes are for query performance only.
--
-- Row Level Security is enabled at the end of this file so Supabase does not leave
-- new tables world-writable via the anon key. With RLS on and no policies yet,
-- direct PostgREST access from the browser is denied; use the service role from
-- server-side API routes until you add policies for client/realtime access.

-- §12.1 incidents
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  public_id text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  mode text not null default 'normal',
  urgency text not null default 'unknown',
  incident_type text not null default 'unknown',
  status text not null default 'active_call',

  operator_required boolean,
  assigned_operator text,
  control_state text not null default 'ai_leading',
  ai_active boolean not null default true,

  location_status text not null default 'unknown',
  location_confidence numeric,
  location text,
  coordinates jsonb,

  summary text,
  collected_fields jsonb not null default '{}'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '[]'::jsonb,
  recommended_action text,

  priority_score numeric,
  cluster_id text,

  transcript_url text,
  audio_url text,
  last_updated_by text not null default 'system'
);

-- §12.2 call_sessions
create table public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents (id) on delete cascade,

  twilio_call_sid text,
  elevenlabs_conversation_id text,

  status text not null default 'active',
  ai_active boolean not null default true,
  turn_count integer not null default 0,

  recent_transcript jsonb not null default '[]'::jsonb,
  required_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  next_question text,

  last_model_confidence numeric,
  should_escalate boolean not null default false,
  operator_transfer_status text not null default 'not_requested',

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- §12.3 transcript_events
create table public.transcript_events (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents (id) on delete cascade,
  call_session_id uuid references public.call_sessions (id) on delete cascade,
  speaker text not null,
  text text not null,
  is_final boolean not null default true,
  language text,
  translated_text text,
  created_at timestamptz default now()
);

-- §12.4 audit_logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents (id) on delete cascade,
  actor text not null,
  action text not null,
  patch jsonb,
  created_at timestamptz default now()
);

-- §12.5 responders
create table public.responders (
  id text primary key,
  type text not null,
  status text not null,
  display_name text not null,
  coordinates jsonb not null,
  assigned_incident_id uuid,
  updated_at timestamptz default now()
);

-- §12.6 event_layers
create table public.event_layers (
  id text primary key,
  mode text not null,
  layer_type text not null,
  name text not null,
  geometry jsonb not null,
  metadata jsonb not null default '{}'::jsonb
);

-- Indexes (not specified in §12; safe defaults for joins and ordering)
create index idx_call_sessions_incident_id on public.call_sessions (incident_id);
create index idx_transcript_events_incident_id on public.transcript_events (incident_id);
create index idx_transcript_events_call_session_id on public.transcript_events (call_session_id);
create index idx_transcript_events_created_at on public.transcript_events (created_at desc);
create index idx_audit_logs_incident_id on public.audit_logs (incident_id);
create index idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index idx_incidents_mode_status on public.incidents (mode, status);
create index idx_incidents_updated_at on public.incidents (updated_at desc);

-- Row Level Security (addresses Supabase “new tables without RLS” warning)
alter table public.incidents enable row level security;
alter table public.call_sessions enable row level security;
alter table public.transcript_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.responders enable row level security;
alter table public.event_layers enable row level security;
