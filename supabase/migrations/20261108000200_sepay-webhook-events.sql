-- SePay connection page: every delivery that reached a workspace's own SePay webhook door is remembered so the owner can follow
-- it live (ping, credit, duplicate, refused key) and read the connection's health. Additive: one new table, no existing table changes.
-- A row is written for a delivery whose connection exists; a refused key is recorded as `unauthorized` and carries no payload.
-- `environment` is the connection's environment at the time, so the page can say whether a credit was only a test.

CREATE TABLE public.channel_connections_sepay_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    outcome text NOT NULL,
    kind text NOT NULL,
    amount_vnd bigint,
    provider_event_id text,
    environment text NOT NULL,
    CONSTRAINT channel_connections_sepay_events_outcome_check CHECK (outcome IN ('accepted', 'duplicate', 'unauthorized')),
    CONSTRAINT channel_connections_sepay_events_kind_check CHECK (kind IN ('credit', 'debit', 'ping')),
    CONSTRAINT channel_connections_sepay_events_environment_check CHECK (environment IN ('test', 'live'))
);

CREATE INDEX channel_connections_sepay_events_connection_received_idx
    ON public.channel_connections_sepay_events USING btree (connection_id, received_at DESC);

ALTER TABLE public.channel_connections_sepay_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.channel_connections_sepay_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.channel_connections_sepay_events TO app_be;

CREATE POLICY channel_connections_sepay_events_app_be_insert ON public.channel_connections_sepay_events
    FOR INSERT TO app_be WITH CHECK (true);
CREATE POLICY channel_connections_sepay_events_app_be_select ON public.channel_connections_sepay_events
    FOR SELECT TO app_be USING (true);
