-- Ampliar bucket rsvp-assets para aceptar PDFs (modo PDF del editor RSVP).
-- - Sube file_size_limit a 15 MiB para permitir invitaciones PDF de calidad.
-- - Agrega application/pdf a los MIME types permitidos.
-- Las RLS existentes (is_event_operator() para INSERT/UPDATE/DELETE, SELECT publico)
-- aplican igual y no requieren cambios. Validacion adicional por kind se hace en
-- el cliente (RSVP_ASSET_RULES en src/lib/eventService.js).
update storage.buckets
set
  file_size_limit = 15728640,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
where id = 'rsvp-assets';
