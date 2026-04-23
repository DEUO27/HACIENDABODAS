drop policy if exists "events_manage_delete" on public.events;

create policy "events_manage_delete"
on public.events
for delete
using (public.is_admin());
