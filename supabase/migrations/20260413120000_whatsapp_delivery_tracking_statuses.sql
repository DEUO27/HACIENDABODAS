alter table public.guests
  drop constraint if exists guests_delivery_status_check;

alter table public.guests
  add constraint guests_delivery_status_check
  check (delivery_status in (
    'draft',
    'queued',
    'scheduled',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'canceled'
  ));

alter table public.message_deliveries
  drop constraint if exists message_deliveries_status_check;

alter table public.message_deliveries
  add constraint message_deliveries_status_check
  check (status in (
    'draft',
    'queued',
    'scheduled',
    'accepted',
    'sent',
    'delivered',
    'read',
    'failed',
    'canceled'
  ));
