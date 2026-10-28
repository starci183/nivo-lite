-- A finished loyalty draft waits on the work-item gate as waiting_decision, distinct from a message still being drafted (waiting).

alter table public.loyalty_campaigns drop constraint if exists loyalty_campaigns_status_check;

alter table public.loyalty_campaigns add constraint loyalty_campaigns_status_check
  check (status in ('draft', 'waiting', 'waiting_decision', 'sending', 'done', 'rejected', 'failed'));
