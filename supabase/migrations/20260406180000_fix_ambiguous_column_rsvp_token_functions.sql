create or replace function public.issue_guest_rsvp_token_core(
  p_guest_id uuid,
  p_event_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  token text,
  token_id uuid,
  guest_id uuid,
  event_id uuid,
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
begin
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
    and rt.used_at is null
    and rt.revoked_at is null;

  insert into public.rsvp_tokens (
    event_id,
    guest_id,
    token_hash,
    expires_at
  )
  values (
    p_event_id,
    p_guest_id,
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
    v_expires_at;
end;
$$;

create or replace function public.issue_guest_rsvp_token(
  p_guest_id uuid,
  p_event_id uuid,
  p_expires_at timestamptz default null
)
returns table (
  token text,
  token_id uuid,
  guest_id uuid,
  event_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_event_operator() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select *
  from public.issue_guest_rsvp_token_core(
    p_guest_id,
    p_event_id,
    p_expires_at
  );
end;
$$;

revoke all on function public.issue_guest_rsvp_token_core(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_guest_rsvp_token_core(uuid, uuid, timestamptz) to service_role;

revoke all on function public.issue_guest_rsvp_token(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.issue_guest_rsvp_token(uuid, uuid, timestamptz) to authenticated, service_role;
