-- The poll plan of every polled connection, one row each, so a tick wakes only the connections that are due instead of scanning all of them.
-- `next_poll_at` is when the connection is read next (the planner adds random jitter, so tenants never poll in step); the scheduler claims due rows
-- with FOR UPDATE SKIP LOCKED, so replicas never poll the same connection. `interval_ms` is the interval it was last planned with: the adaptive
-- choice between healthy webhooks (long), silent or failing ones (short) and hot (shortest, until `hot_until`). `failures` and `breaker_state`
-- are the circuit breaker: an open breaker waits out a cool-down and then lets one probe through (`half_open`); `needs_reauth` parks a
-- connection whose provider refused the credential until the owner connects again. `backfill_to` and `backfill_newest` carry a first-connect
-- backfill from one chunk to the next. The table is written by the backend only, like every poll state.
CREATE TABLE public.connection_poll_schedule (
    connection_id uuid PRIMARY KEY REFERENCES public.connections (id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL,
    provider text NOT NULL,
    next_poll_at timestamptz NOT NULL DEFAULT now(),
    interval_ms integer NOT NULL,
    failures integer NOT NULL DEFAULT 0,
    breaker_state text NOT NULL DEFAULT 'closed',
    breaker_opened_at timestamptz,
    needs_reauth boolean NOT NULL DEFAULT false,
    hot_until timestamptz,
    hot_reason text,
    last_success_at timestamptz,
    last_webhook_at timestamptz,
    backfill_to timestamptz,
    backfill_newest timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT connection_poll_schedule_breaker_check CHECK (breaker_state IN ('closed', 'open', 'half_open')),
    CONSTRAINT connection_poll_schedule_interval_check CHECK (interval_ms > 0),
    CONSTRAINT connection_poll_schedule_failures_check CHECK (failures >= 0)
);

CREATE INDEX connection_poll_schedule_due_idx ON public.connection_poll_schedule (next_poll_at) WHERE needs_reauth = false;
CREATE INDEX connection_poll_schedule_workspace_idx ON public.connection_poll_schedule (workspace_id);

CREATE TRIGGER connection_poll_schedule_set_updated_at BEFORE UPDATE ON public.connection_poll_schedule FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.connection_poll_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.connection_poll_schedule FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.connection_poll_schedule TO app_be;

CREATE POLICY connection_poll_schedule_app_be_select ON public.connection_poll_schedule FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY connection_poll_schedule_app_be_insert ON public.connection_poll_schedule FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY connection_poll_schedule_app_be_update ON public.connection_poll_schedule FOR UPDATE TO app_be
    USING (workspace_id IS NOT NULL)
    WITH CHECK (workspace_id IS NOT NULL);
