-- A connection whose provider plan lacks the capability the poll needs (the OA plan does not allow reading old messages) is no failure: it stays connected
-- and its webhook keeps feeding the inbox. The poll marks the reason here, stops polling it at the normal interval and tries it again rarely.
ALTER TABLE public.connection_poll_schedule ADD COLUMN unavailable_reason text;
ALTER TABLE public.connection_poll_schedule ADD CONSTRAINT connection_poll_schedule_unavailable_check CHECK (unavailable_reason IS NULL OR unavailable_reason IN ('plan'));
