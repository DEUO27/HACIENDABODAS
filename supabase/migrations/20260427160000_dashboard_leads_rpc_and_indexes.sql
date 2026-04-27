create index if not exists leads_fecha_primer_mensaje_idx
on public.leads (fecha_primer_mensaje desc);

create index if not exists leads_lead_id_idx
on public.leads (lead_id);

create index if not exists leads_fase_embudo_idx
on public.leads (fase_embudo);

create index if not exists leads_vendedora_idx
on public.leads (vendedora);

create index if not exists leads_canal_normalizado_idx
on public.leads (canal_normalizado);

create index if not exists leads_evento_normalizado_idx
on public.leads (evento_normalizado);

create index if not exists leads_salon_idx
on public.leads (salon);

create or replace function public.list_dashboard_leads(
  p_search text default '',
  p_page integer default 0,
  p_page_size integer default 1000
)
returns table (
  total_count bigint,
  lead jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page integer := greatest(coalesce(p_page, 0), 0);
  v_page_size integer := least(greatest(coalesce(p_page_size, 1000), 1), 1000);
  v_search text := lower(trim(coalesce(p_search, '')));
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  return query
  with filtered as (
    select l.*
    from public.leads l
    where
      v_search = ''
      or lower(coalesce(l.nombre, '')) like '%' || v_search || '%'
      or lower(coalesce(l.telefono, '')) like '%' || v_search || '%'
      or lower(coalesce(l.lead_id::text, '')) like '%' || v_search || '%'
  )
  select
    count(*) over () as total_count,
    to_jsonb(filtered.*) as lead
  from filtered
  order by filtered.fecha_primer_mensaje desc nulls last
  offset v_page * v_page_size
  limit v_page_size;
end;
$$;

create or replace function public.get_dashboard_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
begin
  if not public.is_admin() then
    raise exception 'Forbidden'
      using errcode = '42501';
  end if;

  select count(*) into v_total from public.leads;

  return jsonb_build_object(
    'total', coalesce(v_total, 0)
  );
end;
$$;

revoke all on function public.list_dashboard_leads(text, integer, integer) from public, anon;
grant execute on function public.list_dashboard_leads(text, integer, integer) to authenticated, service_role;

revoke all on function public.get_dashboard_metrics() from public, anon;
grant execute on function public.get_dashboard_metrics() to authenticated, service_role;
