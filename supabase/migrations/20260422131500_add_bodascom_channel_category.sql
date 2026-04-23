-- Add Bodas.com as an official normalized channel for explicit domain mentions.
-- This is a data-only backfill; no schema change is required because
-- canal_normalizado is text and already stores category labels.

update public.leads
set
    canal_base = case
        when coalesce(canal_de_contacto, '') ilike '%bodas.co%' then btrim(canal_de_contacto)
        when coalesce(como_nos_encontro, '') ilike '%bodas.co%' then btrim(como_nos_encontro)
        else canal_base
    end,
    canal_normalizado = 'Bodas.com',
    canal_razon = 'Keyword_BodasCom'
where
    coalesce(canal_de_contacto, '') ilike '%bodas.co%'
    or coalesce(como_nos_encontro, '') ilike '%bodas.co%';
