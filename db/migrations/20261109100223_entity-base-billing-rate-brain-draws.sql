-- entity-base-billing-rate-brain-draws: forward-only; immutable once on origin/main.
-- Owner ruling 2026-10-31: every table has an entity extending the base, and carries created_at and updated_at (timestamptz NOT NULL DEFAULT now()).
-- Tables billing_config, booking_rate, brain_source_profiles, credit_topup_draws. updated_at is stamped by public.set_updated_at() on a BEFORE UPDATE trigger.
-- Additive and idempotent: ADD COLUMN IF NOT EXISTS, and each trigger is created only when it is missing.

ALTER TABLE public.billing_config ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.billing_config ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_rate ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_rate ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brain_source_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brain_source_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_topup_draws ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_topup_draws ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['billing_config', 'booking_rate', 'brain_source_profiles', 'credit_topup_draws'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = ('public.' || t)::regclass AND tgname = t || '_set_updated_at') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_set_updated_at', t);
    END IF;
  END LOOP;
END
$$;
