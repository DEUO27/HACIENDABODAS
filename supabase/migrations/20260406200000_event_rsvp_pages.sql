create table if not exists public.event_rsvp_pages (
  event_id uuid primary key references public.events(id) on delete cascade,
  theme_key text not null default 'editorial' check (theme_key in ('editorial', 'romantic', 'minimal', 'garden')),
  draft_config jsonb not null default '{}'::jsonb,
  published_config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.event_rsvp_pages enable row level security;

drop trigger if exists set_event_rsvp_pages_updated_at on public.event_rsvp_pages;
create trigger set_event_rsvp_pages_updated_at
before update on public.event_rsvp_pages
for each row execute function public.set_updated_at();

drop policy if exists "event_rsvp_pages_event_operator_select" on public.event_rsvp_pages;
create policy "event_rsvp_pages_event_operator_select"
on public.event_rsvp_pages
for select
using (public.is_event_operator());

drop policy if exists "event_rsvp_pages_event_operator_insert" on public.event_rsvp_pages;
create policy "event_rsvp_pages_event_operator_insert"
on public.event_rsvp_pages
for insert
with check (public.is_event_operator());

drop policy if exists "event_rsvp_pages_event_operator_update" on public.event_rsvp_pages;
create policy "event_rsvp_pages_event_operator_update"
on public.event_rsvp_pages
for update
using (public.is_event_operator())
with check (public.is_event_operator());

drop policy if exists "event_rsvp_pages_event_operator_delete" on public.event_rsvp_pages;
create policy "event_rsvp_pages_event_operator_delete"
on public.event_rsvp_pages
for delete
using (public.is_event_operator());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rsvp-assets',
  'rsvp-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rsvp_assets_public_read" on storage.objects;
create policy "rsvp_assets_public_read"
on storage.objects
for select
using (bucket_id = 'rsvp-assets');

drop policy if exists "rsvp_assets_event_operator_insert" on storage.objects;
create policy "rsvp_assets_event_operator_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'rsvp-assets'
  and public.is_event_operator()
);

drop policy if exists "rsvp_assets_event_operator_update" on storage.objects;
create policy "rsvp_assets_event_operator_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'rsvp-assets'
  and public.is_event_operator()
)
with check (
  bucket_id = 'rsvp-assets'
  and public.is_event_operator()
);

drop policy if exists "rsvp_assets_event_operator_delete" on storage.objects;
create policy "rsvp_assets_event_operator_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'rsvp-assets'
  and public.is_event_operator()
);
