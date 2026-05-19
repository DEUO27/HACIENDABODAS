-- =============================================================
-- Migracion: agregar blueprint "Recordatorio" como tercer template.
-- =============================================================
-- Restaura el mensaje intermedio que fue eliminado en
-- 20260511120000_two_stage_confirmations.sql. El Recordatorio NO es un nuevo
-- stage de RSVP: reusa internamente `confirmacion_1` (mismo token, misma
-- pagina publica, misma columna `attendance_status_1`). Solo agrega un
-- template independiente en Meta para reenviar a quienes aun no respondieron
-- la Inicial.
--
-- Cambios:
-- * `message_blueprints_message_key_check` ahora acepta
--   ('confirmacion_1', 'recordatorio', 'confirmacion_2').
-- * `message_deliveries_message_key_check` ahora acepta los mismos 3 valores.
-- * Inserta fila default en message_blueprints (is_active=false) para que el
--   admin la configure desde /configuracion/mensajes.
-- * NO toca `rsvp_tokens_stage_check`, `rsvp_responses_stage_check`,
--   `sync_guest_attendance_status` ni columnas de `guests` — el stage de RSVP
--   sigue siendo binario.

-- 1. message_blueprints: extender CHECK y agregar fila default.
alter table public.message_blueprints
  drop constraint if exists message_blueprints_message_key_check;

insert into public.message_blueprints
  (channel, message_key, label, meta_template_name, language_code, reference_body, is_active)
values
  (
    'whatsapp',
    'recordatorio',
    'Recordatorio',
    '',
    'es_MX',
    'Hola {nombre}, te recordamos la invitacion de {evento} para el dia {fecha}. Aun no nos confirmas: {link_confirmacion}',
    false
  )
on conflict (channel, message_key) do nothing;

alter table public.message_blueprints
  add constraint message_blueprints_message_key_check
  check (message_key in ('confirmacion_1', 'recordatorio', 'confirmacion_2'));

-- 2. message_deliveries: extender CHECK (default sigue siendo confirmacion_1).
alter table public.message_deliveries
  drop constraint if exists message_deliveries_message_key_check;

alter table public.message_deliveries
  add constraint message_deliveries_message_key_check
  check (message_key in ('confirmacion_1', 'recordatorio', 'confirmacion_2'));
