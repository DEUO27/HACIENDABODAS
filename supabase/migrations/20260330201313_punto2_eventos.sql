create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin', false);
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  event_date date,
  venue text default '',
  timezone text not null default 'America/Mexico_City',
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  notes text default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  phone text default '',
  email text default '',
  guest_group text default '',
  table_name text default '',
  tags text[] not null default '{}'::text[],
  attendance_status text not null default 'pending' check (attendance_status in ('pending', 'confirmed', 'declined')),
  delivery_status text not null default 'draft' check (delivery_status in ('draft', 'queued', 'scheduled', 'sent', 'failed', 'canceled')),
  plus_ones_allowed integer not null default 0 check (plus_ones_allowed >= 0),
  notes text default '',
  source text not null default 'manual',
  dedupe_key text not null,
  responded_at timestamptz,
  last_delivery_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, dedupe_key)
);

create table if not exists public.rsvp_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null unique references public.guests(id) on delete cascade,
  token_id uuid references public.rsvp_tokens(id) on delete set null,
  response_status text not null check (response_status in ('confirmed', 'declined')),
  plus_ones integer not null default 0 check (plus_ones >= 0),
  comment text default '',
  dietary_restrictions text default '',
  responded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  name text not null default 'Invitacion principal',
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, channel)
);

create table if not exists public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  template_id uuid references public.message_templates(id) on delete set null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  rendered_message text not null,
  recipient_phone text not null,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'queued', 'scheduled', 'sent', 'failed', 'canceled')),
  provider_message_id text,
  error_code text,
  attempts integer not null default 0,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists guests_event_id_idx on public.guests(event_id);
create index if not exists guests_attendance_status_idx on public.guests(event_id, attendance_status);
create index if not exists guests_delivery_status_idx on public.guests(event_id, delivery_status);
create index if not exists rsvp_tokens_guest_id_idx on public.rsvp_tokens(guest_id, created_at desc);
create index if not exists message_deliveries_event_id_idx on public.message_deliveries(event_id, created_at desc);
create unique index if not exists message_deliveries_provider_message_id_idx on public.message_deliveries(provider_message_id) where provider_message_id is not null;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists set_guests_updated_at on public.guests;
create trigger set_guests_updated_at
before update on public.guests
for each row execute function public.set_updated_at();

drop trigger if exists set_rsvp_tokens_updated_at on public.rsvp_tokens;
create trigger set_rsvp_tokens_updated_at
before update on public.rsvp_tokens
for each row execute function public.set_updated_at();

drop trigger if exists set_rsvp_responses_updated_at on public.rsvp_responses;
create trigger set_rsvp_responses_updated_at
before update on public.rsvp_responses
for each row execute function public.set_updated_at();

drop trigger if exists set_message_templates_updated_at on public.message_templates;
create trigger set_message_templates_updated_at
before update on public.message_templates
for each row execute function public.set_updated_at();

drop trigger if exists set_message_deliveries_updated_at on public.message_deliveries;
create trigger set_message_deliveries_updated_at
before update on public.message_deliveries
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.guests enable row level security;
alter table public.rsvp_tokens enable row level security;
alter table public.rsvp_responses enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_deliveries enable row level security;

drop policy if exists "events_admin_all" on public.events;
create policy "events_admin_all"
on public.events
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "guests_admin_all" on public.guests;
create policy "guests_admin_all"
on public.guests
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rsvp_tokens_admin_all" on public.rsvp_tokens;
create policy "rsvp_tokens_admin_all"
on public.rsvp_tokens
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rsvp_responses_admin_all" on public.rsvp_responses;
create policy "rsvp_responses_admin_all"
on public.rsvp_responses
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "message_templates_admin_all" on public.message_templates;
create policy "message_templates_admin_all"
on public.message_templates
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "message_deliveries_admin_all" on public.message_deliveries;
create policy "message_deliveries_admin_all"
on public.message_deliveries
for all
using (public.is_admin())
with check (public.is_admin());

create or replace function public.consume_rsvp_token(
  p_token_hash text,
  p_response_status text,
  p_plus_ones integer default 0,
  p_comment text default '',
  p_dietary_restrictions text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rsvp_tokens%rowtype;
  v_now timestamptz := timezone('utc', now());
begin
  select *
    into v_token
  from public.rsvp_tokens
  where token_hash = p_token_hash
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_token');
  end if;

  if v_token.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked_token');
  end if;

  if v_token.used_at is not null then
    return jsonb_build_object('ok', false, 'code', 'used_token');
  end if;

  if v_token.expires_at is not null and v_token.expires_at < v_now then
    return jsonb_build_object('ok', false, 'code', 'expired_token');
  end if;

  if p_response_status not in ('confirmed', 'declined') then
    return jsonb_build_object('ok', false, 'code', 'invalid_response');
  end if;

  insert into public.rsvp_responses (
    event_id,
    guest_id,
    token_id,
    response_status,
    plus_ones,
    comment,
    dietary_restrictions,
    responded_at
  )
  values (
    v_token.event_id,
    v_token.guest_id,
    v_token.id,
    p_response_status,
    greatest(coalesce(p_plus_ones, 0), 0),
    coalesce(p_comment, ''),
    coalesce(p_dietary_restrictions, ''),
    v_now
  )
  on conflict (guest_id) do update
  set
    token_id = excluded.token_id,
    response_status = excluded.response_status,
    plus_ones = excluded.plus_ones,
    comment = excluded.comment,
    dietary_restrictions = excluded.dietary_restrictions,
    responded_at = excluded.responded_at,
    updated_at = v_now;

  update public.guests
  set
    attendance_status = p_response_status,
    responded_at = v_now,
    updated_at = v_now
  where id = v_token.guest_id;

  update public.rsvp_tokens
  set
    used_at = v_now,
    updated_at = v_now
  where id = v_token.id;

  return jsonb_build_object(
    'ok', true,
    'guest_id', v_token.guest_id,
    'event_id', v_token.event_id,
    'attendance_status', p_response_status,
    'responded_at', v_now
  );
end;
$$;
