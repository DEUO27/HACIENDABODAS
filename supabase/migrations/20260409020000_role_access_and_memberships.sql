create or replace function public.current_global_role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_global_role() = 'admin';
$$;

create or replace function public.is_event_operator()
returns boolean
language sql
stable
as $$
  select public.current_global_role() in ('admin', 'planner', 'esposos');
$$;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
  'role',
  coalesce(
    nullif(raw_app_meta_data ->> 'role', ''),
    nullif(raw_user_meta_data ->> 'role', ''),
    'esposos'
  )
)
where coalesce(raw_app_meta_data ->> 'role', '') = '';

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  global_role text not null default 'esposos' check (global_role in ('admin', 'planner', 'esposos')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create or replace function public.sync_user_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );

  insert into public.user_profiles (
    user_id,
    email,
    full_name,
    global_role
  )
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(nullif(new.raw_app_meta_data ->> 'role', ''), 'esposos')
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    global_role = excluded.global_role,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists sync_user_profile_from_auth on auth.users;
create trigger sync_user_profile_from_auth
after insert or update of email, raw_user_meta_data, raw_app_meta_data on auth.users
for each row execute function public.sync_user_profile_from_auth();

insert into public.user_profiles (user_id, email, full_name, global_role)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    ''
  ),
  coalesce(nullif(u.raw_app_meta_data ->> 'role', ''), 'esposos')
from auth.users u
on conflict (user_id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  global_role = excluded.global_role,
  updated_at = timezone('utc', now());

create table if not exists public.event_memberships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_role text not null check (membership_role in ('planner', 'esposos')),
  spouse_slot smallint check (spouse_slot in (1, 2)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id),
  check (
    (membership_role = 'planner' and spouse_slot is null)
    or (membership_role = 'esposos' and spouse_slot in (1, 2))
  )
);

create unique index if not exists event_memberships_single_planner_idx
on public.event_memberships (event_id)
where membership_role = 'planner';

create unique index if not exists event_memberships_spouse_slot_idx
on public.event_memberships (event_id, spouse_slot)
where membership_role = 'esposos';

create unique index if not exists event_memberships_single_spouse_user_idx
on public.event_memberships (user_id)
where membership_role = 'esposos';

create index if not exists event_memberships_event_lookup_idx
on public.event_memberships (event_id, membership_role);

create index if not exists event_memberships_user_lookup_idx
on public.event_memberships (user_id, membership_role);

drop trigger if exists set_event_memberships_updated_at on public.event_memberships;
create trigger set_event_memberships_updated_at
before update on public.event_memberships
for each row execute function public.set_updated_at();

insert into public.event_memberships (event_id, user_id, membership_role, spouse_slot, created_by)
select
  e.id,
  e.created_by,
  'planner',
  null,
  e.created_by
from public.events e
join public.user_profiles up
  on up.user_id = e.created_by
 and up.global_role = 'planner'
where e.created_by is not null
on conflict (event_id, user_id) do nothing;

create or replace function public.can_access_event(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.event_memberships em
      where em.event_id = p_event_id
        and em.user_id = auth.uid()
    );
$$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select public.can_access_event(p_event_id);
$$;

create or replace function public.is_event_planner(p_event_id uuid)
returns boolean
language sql
stable
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.event_memberships em
      where em.event_id = p_event_id
        and em.user_id = auth.uid()
        and em.membership_role = 'planner'
    );
$$;

create or replace function public.storage_object_event_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v_event_id text;
begin
  if split_part(coalesce(p_name, ''), '/', 1) <> 'event' then
    return null;
  end if;

  v_event_id := split_part(p_name, '/', 2);

  if v_event_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return v_event_id::uuid;
  end if;

  return null;
exception
  when others then
    return null;
end;
$$;

create or replace function public.set_event_creator()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_event_creator on public.events;
create trigger set_event_creator
before insert on public.events
for each row execute function public.set_event_creator();

create or replace function public.assign_planner_membership_on_event_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if public.current_global_role() = 'planner' and auth.uid() is not null then
    insert into public.event_memberships (event_id, user_id, membership_role, spouse_slot, created_by)
    values (new.id, auth.uid(), 'planner', null, auth.uid())
    on conflict (event_id, user_id) do update
    set
      membership_role = excluded.membership_role,
      spouse_slot = excluded.spouse_slot,
      updated_at = timezone('utc', now());
  end if;

  return new;
end;
$$;

drop trigger if exists assign_planner_membership_on_event_insert on public.events;
create trigger assign_planner_membership_on_event_insert
after insert on public.events
for each row execute function public.assign_planner_membership_on_event_insert();

create or replace function public.list_event_accounts(p_event_id uuid)
returns table (
  membership_id uuid,
  event_id uuid,
  user_id uuid,
  membership_role text,
  spouse_slot smallint,
  email text,
  full_name text,
  global_role text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_event(p_event_id) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  select
    em.id,
    em.event_id,
    em.user_id,
    em.membership_role,
    em.spouse_slot,
    up.email,
    up.full_name,
    up.global_role
  from public.event_memberships em
  join public.user_profiles up
    on up.user_id = em.user_id
  where em.event_id = p_event_id
  order by
    case em.membership_role
      when 'planner' then 0
      else 1
    end,
    em.spouse_slot nulls last,
    up.email;
end;
$$;

create or replace function public.assign_event_planner(
  p_event_id uuid,
  p_planner_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select *
    into v_profile
  from public.user_profiles
  where user_id = p_planner_user_id
  limit 1;

  if not found or v_profile.global_role <> 'planner' then
    raise exception 'Planner no encontrado.'
      using errcode = 'P0002';
  end if;

  delete from public.event_memberships
  where event_id = p_event_id
    and membership_role = 'planner';

  insert into public.event_memberships (
    event_id,
    user_id,
    membership_role,
    spouse_slot,
    created_by
  )
  values (
    p_event_id,
    p_planner_user_id,
    'planner',
    null,
    auth.uid()
  )
  on conflict (event_id, user_id) do update
  set
    membership_role = 'planner',
    spouse_slot = null,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.upsert_event_spouse_membership(
  p_event_id uuid,
  p_user_id uuid,
  p_spouse_slot smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.user_profiles%rowtype;
  v_existing_slot public.event_memberships%rowtype;
  v_existing_user public.event_memberships%rowtype;
begin
  if not (public.is_admin() or public.is_event_planner(p_event_id)) then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  if p_spouse_slot not in (1, 2) then
    raise exception 'Debes elegir un espacio valido para los esposos.'
      using errcode = '22023';
  end if;

  select *
    into v_profile
  from public.user_profiles
  where user_id = p_user_id
  limit 1;

  if not found or v_profile.global_role <> 'esposos' then
    raise exception 'La cuenta indicada no tiene rol de esposos.'
      using errcode = '22023';
  end if;

  select *
    into v_existing_user
  from public.event_memberships
  where user_id = p_user_id
    and membership_role = 'esposos'
  limit 1;

  if found and v_existing_user.event_id <> p_event_id then
    raise exception 'Esta cuenta de esposos ya esta asignada a otro evento.'
      using errcode = '23505';
  end if;

  select *
    into v_existing_slot
  from public.event_memberships
  where event_id = p_event_id
    and membership_role = 'esposos'
    and spouse_slot = p_spouse_slot
  limit 1;

  if found and v_existing_slot.user_id <> p_user_id then
    delete from public.event_memberships
    where id = v_existing_slot.id;
  end if;

  insert into public.event_memberships (
    event_id,
    user_id,
    membership_role,
    spouse_slot,
    created_by
  )
  values (
    p_event_id,
    p_user_id,
    'esposos',
    p_spouse_slot,
    auth.uid()
  )
  on conflict (event_id, user_id) do update
  set
    membership_role = 'esposos',
    spouse_slot = excluded.spouse_slot,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.remove_event_membership(
  p_event_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.event_memberships%rowtype;
begin
  select *
    into v_membership
  from public.event_memberships
  where event_id = p_event_id
    and user_id = p_user_id
  limit 1;

  if not found then
    return false;
  end if;

  if public.is_admin() then
    delete from public.event_memberships
    where id = v_membership.id;
    return true;
  end if;

  if public.is_event_planner(p_event_id) and v_membership.membership_role = 'esposos' then
    delete from public.event_memberships
    where id = v_membership.id;
    return true;
  end if;

  raise exception 'Forbidden'
    using errcode = '42501';
end;
$$;

revoke all on function public.list_event_accounts(uuid) from public, anon;
grant execute on function public.list_event_accounts(uuid) to authenticated, service_role;

revoke all on function public.assign_event_planner(uuid, uuid) from public, anon;
grant execute on function public.assign_event_planner(uuid, uuid) to authenticated, service_role;

revoke all on function public.upsert_event_spouse_membership(uuid, uuid, smallint) from public, anon;
grant execute on function public.upsert_event_spouse_membership(uuid, uuid, smallint) to authenticated, service_role;

revoke all on function public.remove_event_membership(uuid, uuid) from public, anon;
grant execute on function public.remove_event_membership(uuid, uuid) to authenticated, service_role;

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
  if not public.can_manage_event(p_event_id) then
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

alter table public.user_profiles enable row level security;
alter table public.event_memberships enable row level security;

drop policy if exists "user_profiles_admin_select" on public.user_profiles;
create policy "user_profiles_admin_select"
on public.user_profiles
for select
using (public.is_admin());

drop policy if exists "user_profiles_self_select" on public.user_profiles;
create policy "user_profiles_self_select"
on public.user_profiles
for select
using (user_id = auth.uid());

drop policy if exists "event_memberships_admin_all" on public.event_memberships;
create policy "event_memberships_admin_all"
on public.event_memberships
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "event_memberships_self_select" on public.event_memberships;
create policy "event_memberships_self_select"
on public.event_memberships
for select
using (user_id = auth.uid());

drop policy if exists "events_admin_all" on public.events;
drop policy if exists "events_event_operator_all" on public.events;
create policy "events_access_select"
on public.events
for select
using (public.can_access_event(id));

drop policy if exists "events_manage_insert" on public.events;
create policy "events_manage_insert"
on public.events
for insert
with check (public.current_global_role() in ('admin', 'planner'));

drop policy if exists "events_manage_update" on public.events;
create policy "events_manage_update"
on public.events
for update
using (public.is_admin() or public.is_event_planner(id))
with check (public.is_admin() or public.is_event_planner(id));

drop policy if exists "events_manage_delete" on public.events;
create policy "events_manage_delete"
on public.events
for delete
using (public.is_admin() or public.is_event_planner(id));

drop policy if exists "guests_admin_all" on public.guests;
drop policy if exists "guests_event_operator_all" on public.guests;
create policy "guests_event_access_all"
on public.guests
for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "rsvp_tokens_admin_all" on public.rsvp_tokens;
drop policy if exists "rsvp_tokens_event_operator_all" on public.rsvp_tokens;
create policy "rsvp_tokens_event_access_all"
on public.rsvp_tokens
for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "rsvp_responses_admin_all" on public.rsvp_responses;
drop policy if exists "rsvp_responses_event_operator_all" on public.rsvp_responses;
create policy "rsvp_responses_event_access_all"
on public.rsvp_responses
for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "message_templates_admin_all" on public.message_templates;
drop policy if exists "message_templates_event_operator_all" on public.message_templates;
create policy "message_templates_event_access_all"
on public.message_templates
for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "message_deliveries_admin_all" on public.message_deliveries;
drop policy if exists "message_deliveries_event_operator_all" on public.message_deliveries;
create policy "message_deliveries_event_access_all"
on public.message_deliveries
for all
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "event_rsvp_pages_event_operator_select" on public.event_rsvp_pages;
drop policy if exists "event_rsvp_pages_event_operator_insert" on public.event_rsvp_pages;
drop policy if exists "event_rsvp_pages_event_operator_update" on public.event_rsvp_pages;
drop policy if exists "event_rsvp_pages_event_operator_delete" on public.event_rsvp_pages;
create policy "event_rsvp_pages_event_access_select"
on public.event_rsvp_pages
for select
using (public.can_manage_event(event_id));

create policy "event_rsvp_pages_event_access_insert"
on public.event_rsvp_pages
for insert
with check (public.can_manage_event(event_id));

create policy "event_rsvp_pages_event_access_update"
on public.event_rsvp_pages
for update
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

create policy "event_rsvp_pages_event_access_delete"
on public.event_rsvp_pages
for delete
using (public.can_manage_event(event_id));

drop policy if exists "message_blueprints_event_operator_select" on public.message_blueprints;
drop policy if exists "message_blueprints_admin_all" on public.message_blueprints;
create policy "message_blueprints_access_select"
on public.message_blueprints
for select
using (public.current_global_role() in ('admin', 'planner', 'esposos'));

create policy "message_blueprints_admin_all"
on public.message_blueprints
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "rsvp_assets_event_operator_insert" on storage.objects;
drop policy if exists "rsvp_assets_event_operator_update" on storage.objects;
drop policy if exists "rsvp_assets_event_operator_delete" on storage.objects;
create policy "rsvp_assets_event_access_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rsvp-assets'
  and public.can_manage_event(public.storage_object_event_id(name))
);

create policy "rsvp_assets_event_access_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rsvp-assets'
  and public.can_manage_event(public.storage_object_event_id(name))
)
with check (
  bucket_id = 'rsvp-assets'
  and public.can_manage_event(public.storage_object_event_id(name))
);

create policy "rsvp_assets_event_access_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rsvp-assets'
  and public.can_manage_event(public.storage_object_event_id(name))
);
