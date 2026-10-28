-- Guided connection wizard: a connection has an ENVIRONMENT (provider test mode vs live), can be 'pending' until its first
-- real webhook arrives, and remembers that first event so the wizard can say "received +X d".
--   environment   'test' = the provider's sandbox/test mode: its credits are stored with origin 'simulated' (never real money).
--                 Existing rows are 'live'.
--   status        adds 'pending' (created by the wizard, setup not finished or no event seen yet).
--   provider      adds the payment/bank providers payos and casso.
--   last_event_at the latest webhook accepted for this connection; first_event the first one {amount, content, at}.
alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in ('telegram', 'sepay', 'zalo_oa', 'payos', 'casso'));
alter table public.connections drop constraint if exists connections_status_check;
alter table public.connections add constraint connections_status_check check (status in ('pending', 'connected', 'error', 'disconnected'));
alter table public.connections add column if not exists environment text not null default 'live' check (environment in ('test', 'live'));
alter table public.connections add column if not exists last_event_at timestamptz;
alter table public.connections add column if not exists first_event jsonb;
