-- entity-base-timestamps-logs-a-h: forward-only; immutable once on origin/main.
-- Owner ruling 2026-10-31: every table, logs/ledgers/audit/version tables included, carries created_at and updated_at (timestamptz NOT NULL DEFAULT now()) and its entity extends the base.
-- Tables agent_access_log to hiring_retention_log (a to h). updated_at is stamped by public.set_updated_at() on a BEFORE UPDATE trigger; tables that refuse UPDATE through their own immutability trigger keep it, the extra trigger never fires for them.
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, and each trigger is created only when it is missing.

ALTER TABLE public.agent_access_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.agent_connections ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.ai_usage_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.app_errors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_hours ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_hours ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brain_eval_cases ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.channel_connections_sepay_events ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.channel_connections_sepay_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.channel_receipts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.connector_interest ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_plans ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_weekly_reports ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_weekly_reports ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.conversation_ownership_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_apply_hits ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_consents ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_consents ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_retention_log ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_retention_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_access_log', 'agent_connections', 'ai_usage_events', 'app_errors', 'billing_events', 'booking_hours', 'brain_eval_cases', 'channel_connections_sepay_events', 'channel_receipts', 'connector_interest', 'content_plans', 'content_weekly_reports', 'conversation_ownership_events', 'email_messages', 'events', 'hiring_apply_hits', 'hiring_consents', 'hiring_events', 'hiring_retention_log'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = t || '_set_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END
$$;
