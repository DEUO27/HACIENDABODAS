alter table if exists public.leads
add column if not exists import_job_id text;

create index if not exists leads_import_job_id_idx
on public.leads (import_job_id);

create index if not exists leads_fuente_created_at_import_idx
on public.leads (fuente, created_at_import desc);
