-- entity-base-timestamps-logs-i-z: forward-only; immutable once on origin/main.
-- Owner ruling 2026-10-31: every table, logs/ledgers/audit/version tables included, carries created_at and updated_at (timestamptz NOT NULL DEFAULT now()) and its entity extends the base.
-- Tables inbox to video_project_versions (i to z). updated_at is stamped by public.set_updated_at() on a BEFORE UPDATE trigger; tables that refuse UPDATE through their own immutability trigger keep it, the extra trigger never fires for them.
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, and each trigger is created only when it is missing.

ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.inbox ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.loyalty_ledger ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mcp_call_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.module_context_versions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.module_context_versions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.module_setup_messages ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.platform_audit ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.realtime_events ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.video_project_versions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['inbox', 'inventory_movements', 'loyalty_ledger', 'mcp_call_log', 'module_context_versions', 'module_setup_messages', 'platform_audit', 'realtime_events', 'video_project_versions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = t || '_set_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END
$$;
