-- infra-tables-entity-base: forward-only; immutable once on origin/main.
-- Owner ruling 2026-10-31: every table has an entity extending the base, and carries created_at and updated_at (timestamptz NOT NULL DEFAULT now()).
-- Tables queue, api_rate_limits, job_slots, job_ticks. updated_at is stamped by public.set_updated_at() on a BEFORE UPDATE trigger.
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, and each trigger is created only when it is missing.
-- queue already had created_at without a default: it gets the default so the database stamps it, as the entity base expects.

ALTER TABLE public.queue ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.queue ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.api_rate_limits ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.api_rate_limits ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_slots ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_slots ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_ticks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.job_ticks ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['queue', 'api_rate_limits', 'job_slots', 'job_ticks'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = t || '_set_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END
$$;
