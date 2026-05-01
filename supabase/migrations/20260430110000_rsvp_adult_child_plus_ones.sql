alter table public.rsvp_responses
  add column if not exists adult_plus_ones integer not null default 0 check (adult_plus_ones >= 0),
  add column if not exists child_plus_ones integer not null default 0 check (child_plus_ones >= 0);

update public.rsvp_responses
set
  adult_plus_ones = greatest(coalesce(adult_plus_ones, plus_ones, 0), coalesce(plus_ones, 0)),
  child_plus_ones = coalesce(child_plus_ones, 0),
  plus_ones = greatest(coalesce(adult_plus_ones, plus_ones, 0), coalesce(plus_ones, 0)) + coalesce(child_plus_ones, 0)
where adult_plus_ones = 0
  and child_plus_ones = 0
  and coalesce(plus_ones, 0) > 0;

create or replace function public.sync_rsvp_response_plus_ones()
returns trigger
language plpgsql
as $$
begin
  new.adult_plus_ones = greatest(coalesce(new.adult_plus_ones, 0), 0);
  new.child_plus_ones = greatest(coalesce(new.child_plus_ones, 0), 0);

  if new.adult_plus_ones = 0
    and new.child_plus_ones = 0
    and coalesce(new.plus_ones, 0) > 0 then
    new.adult_plus_ones = greatest(coalesce(new.plus_ones, 0), 0);
  end if;

  if new.response_status = 'declined' then
    new.adult_plus_ones = 0;
    new.child_plus_ones = 0;
  end if;

  new.plus_ones = new.adult_plus_ones + new.child_plus_ones;
  return new;
end;
$$;

drop trigger if exists sync_rsvp_response_plus_ones on public.rsvp_responses;
create trigger sync_rsvp_response_plus_ones
before insert or update on public.rsvp_responses
for each row execute function public.sync_rsvp_response_plus_ones();

drop function if exists public.consume_rsvp_token(text, text, integer, text, text);

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
    p_response_status,
    v_total_plus_ones,
    v_adult_plus_ones,
    v_child_plus_ones,
    coalesce(p_comment, ''),
    coalesce(p_dietary_restrictions, ''),
    v_now
  )
  on conflict (guest_id) do update
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
    'plus_ones', v_total_plus_ones,
    'adult_plus_ones', v_adult_plus_ones,
    'child_plus_ones', v_child_plus_ones,
    'responded_at', v_now
  );
end;
$$;
