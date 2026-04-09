create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.is_event_operator()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'esposos'), false);
$$;

create table if not exists public.message_blueprints (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'whatsapp' check (channel in ('whatsapp')),
  message_key text not null check (message_key in ('invitation_main', 'rsvp_reminder', 'last_call')),
  label text not null,
  meta_template_name text not null default '',
  language_code text not null default 'es_MX',
  reference_body text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (channel, message_key)
);

insert into public.message_blueprints (channel, message_key, label, meta_template_name, language_code, reference_body, is_active)
values
  ('whatsapp', 'invitation_main', 'Invitacion principal', '', 'es_MX', 'Hola {nombre}, te compartimos la invitacion de {evento} para el dia {fecha}. Confirma aqui: {link_confirmacion}', false),
  ('whatsapp', 'rsvp_reminder', 'Recordatorio RSVP', '', 'es_MX', 'Hola {nombre}, solo queremos recordarte la invitacion de {evento} para el dia {fecha}. Puedes confirmar aqui: {link_confirmacion}', false),
  ('whatsapp', 'last_call', 'Ultimo recordatorio', '', 'es_MX', 'Hola {nombre}, estamos cerrando la lista final de {evento} para el dia {fecha}. Si aun no confirmas, este es tu ultimo recordatorio: {link_confirmacion}', false)
on conflict (channel, message_key) do nothing;

alter table public.message_blueprints enable row level security;

drop trigger if exists set_message_blueprints_updated_at on public.message_blueprints;
create trigger set_message_blueprints_updated_at
before update on public.message_blueprints
for each row execute function public.set_updated_at();

drop policy if exists "message_blueprints_event_operator_select" on public.message_blueprints;
create policy "message_blueprints_event_operator_select"
on public.message_blueprints
for select
using (public.is_event_operator());

drop policy if exists "message_blueprints_admin_all" on public.message_blueprints;
create policy "message_blueprints_admin_all"
on public.message_blueprints
for all
using (public.is_admin())
with check (public.is_admin());

alter table public.message_deliveries add column if not exists message_key text;

update public.message_deliveries
set message_key = 'invitation_main'
where message_key is null;

alter table public.message_deliveries
alter column message_key set default 'invitation_main';

alter table public.message_deliveries
alter column message_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'message_deliveries_message_key_check'
  ) then
    alter table public.message_deliveries
      add constraint message_deliveries_message_key_check
      check (message_key in ('invitation_main', 'rsvp_reminder', 'last_call'));
  end if;
end
$$;

drop policy if exists "events_admin_all" on public.events;
create policy "events_event_operator_all"
on public.events
for all
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "guests_admin_all" on public.guests;
create policy "guests_event_operator_all"
on public.guests
for all
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "rsvp_tokens_admin_all" on public.rsvp_tokens;
create policy "rsvp_tokens_event_operator_all"
on public.rsvp_tokens
for all
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "rsvp_responses_admin_all" on public.rsvp_responses;
create policy "rsvp_responses_event_operator_all"
on public.rsvp_responses
for all
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "message_templates_admin_all" on public.message_templates;
create policy "message_templates_event_operator_all"
on public.message_templates
for all
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "message_deliveries_admin_all" on public.message_deliveries;
create policy "message_deliveries_event_operator_all"
on public.message_deliveries
for all
using (public.is_event_operator())
with check (public.is_event_operator());

create table if not exists public.message_scheduler_config (
  id boolean primary key default true,
  cron_secret text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (id = true)
);

insert into public.message_scheduler_config (id, cron_secret)
values (true, encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (id) do nothing;

drop trigger if exists set_message_scheduler_config_updated_at on public.message_scheduler_config;
create trigger set_message_scheduler_config_updated_at
before update on public.message_scheduler_config
for each row execute function public.set_updated_at();

alter table public.message_scheduler_config enable row level security;

drop policy if exists "message_scheduler_config_admin_select" on public.message_scheduler_config;
create policy "message_scheduler_config_admin_select"
on public.message_scheduler_config
for select
using (public.is_admin());

drop policy if exists "message_scheduler_config_admin_all" on public.message_scheduler_config;
create policy "message_scheduler_config_admin_all"
on public.message_scheduler_config
for all
using (public.is_admin())
with check (public.is_admin());

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'process-scheduled-whatsapp-every-minute';

  perform cron.schedule(
    'process-scheduled-whatsapp-every-minute',
    '* * * * *',
    $job$
      select net.http_post(
        url := 'https://zlndbbvnnciimugsacfs.supabase.co/functions/v1/process-scheduled-whatsapp',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select cron_secret from public.message_scheduler_config where id = true)
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end
$$;
