-- =============================================================
-- Migracion: dos etapas de confirmacion (Confirmacion 1 / 2).
-- =============================================================
-- Reemplaza el catalogo de plantillas (invitation_main / rsvp_reminder /
-- last_call) por dos etapas reales de RSVP (`confirmacion_1` y `confirmacion_2`).
-- Cada invitado puede tener dos tokens y dos respuestas coexistiendo: la primera
-- y la re-confirmacion mas cercana al evento.
--
-- Cambios clave:
-- * Conserva datos existentes (eventos/invitados/respuestas/tokens/deliveries).
--   - rsvp_responses y rsvp_tokens previos se etiquetan como `confirmacion_1`.
--   - message_deliveries con keys legacy se remapean a `confirmacion_1` (eran
--     todos parte del primer flujo de RSVP).
--   - message_blueprints: `invitation_main` se renombra a `confirmacion_1`
--     (conserva meta_template_name + reference_body), `rsvp_reminder` se renombra
--     a `confirmacion_2` (idem) y `last_call` se elimina.
--   - guests.attendance_status se backfillea hacia attendance_status_1 antes de
--     eliminar la columna; attendance_status_2 arranca en 'pending' para todos.
-- * `rsvp_responses` deja de ser UNIQUE(guest_id) para serlo UNIQUE(guest_id, stage).
-- * `rsvp_tokens` gana columna `stage`.
-- * `issue_guest_rsvp_token` / `_core` aceptan `p_stage` y solo revocan tokens
--   previos de la misma etapa.
-- * `consume_rsvp_token` deriva la etapa del token y hace upsert por (guest, stage).

-- 1. Catalogo message_blueprints: relaja CHECK, remapea keys, re-aplica CHECK.
alter table public.message_blueprints
  drop constraint if exists message_blueprints_message_key_check;

update public.message_blueprints
set
  message_key = 'confirmacion_1',
  label = 'Confirmacion 1',
  updated_at = timezone('utc', now())
where channel = 'whatsapp' and message_key = 'invitation_main';

update public.message_blueprints
set
  message_key = 'confirmacion_2',
  label = 'Confirmacion 2',
  updated_at = timezone('utc', now())
where channel = 'whatsapp' and message_key = 'rsvp_reminder';

delete from public.message_blueprints
where channel = 'whatsapp' and message_key = 'last_call';

insert into public.message_blueprints
  (channel, message_key, label, meta_template_name, language_code, reference_body, is_active)
values
  (
    'whatsapp',
    'confirmacion_1',
    'Confirmacion 1',
    '',
    'es_MX',
    'Hola {nombre}, te compartimos la invitacion de {evento} para el dia {fecha}. Confirma tu asistencia aqui: {link_confirmacion}',
    false
  ),
  (
    'whatsapp',
    'confirmacion_2',
    'Confirmacion 2',
    '',
    'es_MX',
    'Hola {nombre}, estamos cerrando la lista final de {evento} el {fecha}. Re-confirma tu asistencia aqui: {link_confirmacion}',
    false
  )
on conflict (channel, message_key) do nothing;

alter table public.message_blueprints
  add constraint message_blueprints_message_key_check
  check (message_key in ('confirmacion_1', 'confirmacion_2'));

-- 2. message_deliveries: remap legacy keys -> confirmacion_1, nuevo CHECK y default.
alter table public.message_deliveries
  drop constraint if exists message_deliveries_message_key_check;

update public.message_deliveries
set message_key = 'confirmacion_1'
where message_key in ('invitation_main', 'rsvp_reminder', 'last_call');

alter table public.message_deliveries
  add constraint message_deliveries_message_key_check
  check (message_key in ('confirmacion_1', 'confirmacion_2'));

alter table public.message_deliveries
  alter column message_key set default 'confirmacion_1';

-- 3. rsvp_tokens: columna stage (default confirmacion_1) + indice.
alter table public.rsvp_tokens
  add column if not exists stage text not null default 'confirmacion_1';

alter table public.rsvp_tokens
  drop constraint if exists rsvp_tokens_stage_check;

alter table public.rsvp_tokens
  add constraint rsvp_tokens_stage_check
  check (stage in ('confirmacion_1', 'confirmacion_2'));

create index if not exists rsvp_tokens_guest_stage_idx
  on public.rsvp_tokens(event_id, guest_id, stage, created_at desc);

-- 4. rsvp_responses: columna stage (default confirmacion_1) + UNIQUE(guest_id, stage).
alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_guest_id_key;

alter table public.rsvp_responses
  add column if not exists stage text not null default 'confirmacion_1';

alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_stage_check;

alter table public.rsvp_responses
  add constraint rsvp_responses_stage_check
  check (stage in ('confirmacion_1', 'confirmacion_2'));

alter table public.rsvp_responses
  drop constraint if exists rsvp_responses_guest_stage_unique;

alter table public.rsvp_responses
  add constraint rsvp_responses_guest_stage_unique unique (guest_id, stage);

-- 5. guests: attendance_status_1 / _2, backfill desde attendance_status, drop columna.
drop index if exists guests_attendance_status_idx;

alter table public.guests
  add column if not exists attendance_status_1 text not null default 'pending';

alter table public.guests
  drop constraint if exists guests_attendance_status_1_check;

alter table public.guests
  add constraint guests_attendance_status_1_check
  check (attendance_status_1 in ('pending', 'confirmed', 'declined'));

alter table public.guests
  add column if not exists attendance_status_2 text not null default 'pending';

alter table public.guests
  drop constraint if exists guests_attendance_status_2_check;

alter table public.guests
  add constraint guests_attendance_status_2_check
  check (attendance_status_2 in ('pending', 'confirmed', 'declined'));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'guests'
      and column_name = 'attendance_status'
  ) then
    execute $sql$
      update public.guests
      set attendance_status_1 = attendance_status
      where attendance_status in ('confirmed', 'declined', 'pending')
        and attendance_status_1 = 'pending'
    $sql$;
  end if;
end
$$;

alter table public.guests
  drop column if exists attendance_status;

create index if not exists guests_attendance_status_1_idx
  on public.guests(event_id, attendance_status_1);
create index if not exists guests_attendance_status_2_idx
  on public.guests(event_id, attendance_status_2);

-- 6. Trigger: sincroniza attendance_status_{stage} en guests cuando hay respuesta.
create or replace function public.sync_guest_attendance_status()
returns trigger
language plpgsql
as $$
begin
  if new.stage = 'confirmacion_1' then
    update public.guests
    set
      attendance_status_1 = new.response_status,
      responded_at = greatest(responded_at, new.responded_at),
      updated_at = timezone('utc', now())
    where id = new.guest_id;
  elsif new.stage = 'confirmacion_2' then
    update public.guests
    set
      attendance_status_2 = new.response_status,
      responded_at = greatest(responded_at, new.responded_at),
      updated_at = timezone('utc', now())
    where id = new.guest_id;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_guest_attendance_status on public.rsvp_responses;
create trigger sync_guest_attendance_status
after insert or update on public.rsvp_responses
for each row execute function public.sync_guest_attendance_status();

-- 7. RPC: issue_guest_rsvp_token_core (acepta p_stage).
drop function if exists public.issue_guest_rsvp_token_core(uuid, uuid, timestamptz);
drop function if exists public.issue_guest_rsvp_token_core(uuid, uuid, text, timestamptz);

create or replace function public.issue_guest_rsvp_token_core(
  p_guest_id uuid,
  p_event_id uuid,
  p_stage text default 'confirmacion_1',
  p_expires_at timestamptz default null
)
returns table (
  token text,
  token_id uuid,
  guest_id uuid,
  event_id uuid,
  stage text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_guest public.guests%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash text := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_token_id uuid;
  v_expires_at timestamptz := p_expires_at;
  v_stage text := coalesce(nullif(trim(p_stage), ''), 'confirmacion_1');
begin
  if v_stage not in ('confirmacion_1', 'confirmacion_2') then
    raise exception 'Etapa de RSVP invalida: %', v_stage
      using errcode = '22023';
  end if;

  select *
    into v_guest
  from public.guests g
  where g.id = p_guest_id
    and g.event_id = p_event_id
  limit 1
  for update;

  if not found then
    raise exception 'Invitado no encontrado.'
      using errcode = 'P0002';
  end if;

  update public.rsvp_tokens rt
  set
    revoked_at = v_now,
    updated_at = v_now
  where rt.guest_id = p_guest_id
    and rt.stage = v_stage
    and rt.used_at is null
    and rt.revoked_at is null;

  insert into public.rsvp_tokens (
    event_id,
    guest_id,
    stage,
    token_hash,
    expires_at
  )
  values (
    p_event_id,
    p_guest_id,
    v_stage,
    v_token_hash,
    v_expires_at
  )
  returning id, public.rsvp_tokens.expires_at
  into v_token_id, v_expires_at;

  return query
  select
    v_token,
    v_token_id,
    p_guest_id,
    p_event_id,
    v_stage,
    v_expires_at;
end;
$$;

-- 8. RPC: issue_guest_rsvp_token (acepta p_stage, valida acceso).
drop function if exists public.issue_guest_rsvp_token(uuid, uuid, timestamptz);
drop function if exists public.issue_guest_rsvp_token(uuid, uuid, text, timestamptz);

create or replace function public.issue_guest_rsvp_token(
  p_guest_id uuid,
  p_event_id uuid,
  p_stage text default 'confirmacion_1',
  p_expires_at timestamptz default null
)
returns table (
  token text,
  token_id uuid,
  guest_id uuid,
  event_id uuid,
  stage text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select *
  from public.issue_guest_rsvp_token_core(
    p_guest_id,
    p_event_id,
    p_stage,
    p_expires_at
  );
end;
$$;

revoke all on function public.issue_guest_rsvp_token_core(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_guest_rsvp_token_core(uuid, uuid, text, timestamptz) to service_role;

revoke all on function public.issue_guest_rsvp_token(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.issue_guest_rsvp_token(uuid, uuid, text, timestamptz) to authenticated, service_role;

-- 9. RPC: consume_rsvp_token (deriva stage del token).
drop function if exists public.consume_rsvp_token(text, text, integer, text, text);
drop function if exists public.consume_rsvp_token(text, text, integer, text, text, integer, integer);

create or replace function public.consume_rsvp_token(
  p_token_hash text,
  p_response_status text,
  p_plus_ones integer default 0,
  p_comment text default '',
  p_dietary_restrictions text default '',
  p_adult_plus_ones integer default null,
  p_child_plus_ones integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token public.rsvp_tokens%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_allowed_plus_ones integer := 0;
  v_adult_plus_ones integer := 0;
  v_child_plus_ones integer := 0;
  v_total_plus_ones integer := 0;
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

  select coalesce(plus_ones_allowed, 0)
    into v_allowed_plus_ones
  from public.guests
  where id = v_token.guest_id;

  if p_response_status = 'confirmed' then
    v_adult_plus_ones := greatest(coalesce(p_adult_plus_ones, p_plus_ones, 0), 0);
    v_child_plus_ones := greatest(coalesce(p_child_plus_ones, 0), 0);
  end if;

  v_total_plus_ones := v_adult_plus_ones + v_child_plus_ones;

  if v_total_plus_ones > v_allowed_plus_ones then
    return jsonb_build_object('ok', false, 'code', 'too_many_plus_ones');
  end if;

  insert into public.rsvp_responses (
    event_id,
    guest_id,
    token_id,
    stage,
    response_status,
    plus_ones,
    adult_plus_ones,
    child_plus_ones,
    comment,
    dietary_restrictions,
    responded_at
  )
  values (
    v_token.event_id,
    v_token.guest_id,
    v_token.id,
    v_token.stage,
    p_response_status,
    v_total_plus_ones,
    v_adult_plus_ones,
    v_child_plus_ones,
    coalesce(p_comment, ''),
    coalesce(p_dietary_restrictions, ''),
    v_now
  )
  on conflict (guest_id, stage) do update
  set
    token_id = excluded.token_id,
    response_status = excluded.response_status,
    plus_ones = excluded.plus_ones,
    adult_plus_ones = excluded.adult_plus_ones,
    child_plus_ones = excluded.child_plus_ones,
    comment = excluded.comment,
    dietary_restrictions = excluded.dietary_restrictions,
    responded_at = excluded.responded_at,
    updated_at = v_now;

  update public.rsvp_tokens
  set
    used_at = v_now,
    updated_at = v_now
  where id = v_token.id;

  return jsonb_build_object(
    'ok', true,
    'guest_id', v_token.guest_id,
    'event_id', v_token.event_id,
    'stage', v_token.stage,
    'attendance_status', p_response_status,
    'plus_ones', v_total_plus_ones,
    'adult_plus_ones', v_adult_plus_ones,
    'child_plus_ones', v_child_plus_ones,
    'responded_at', v_now
  );
end;
$$;
