-- entity-base-contracts-to-hiring: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), content, contract, credit, data, decision, execution and hiring tables (a to k): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at) stamps updated_at, so the application never writes it.
-- Left out on purpose: append-only logs, ledgers and dedupe claims, where an updated_at would be wrong (listed in the entity-base round notes).

ALTER TABLE public.content_brand_proposals ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER content_brand_proposals_set_updated_at BEFORE UPDATE ON public.content_brand_proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_cadence ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER content_cadence_set_updated_at BEFORE UPDATE ON public.content_cadence FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_engagement_daily ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.content_engagement_daily ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER content_engagement_daily_set_updated_at BEFORE UPDATE ON public.content_engagement_daily FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


ALTER TABLE public.content_pillars ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER content_pillars_set_updated_at BEFORE UPDATE ON public.content_pillars FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.content_settings ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER contracts_set_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_pack_purchases ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_pack_purchases ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER credit_pack_purchases_set_updated_at BEFORE UPDATE ON public.credit_pack_purchases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_packs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_packs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER credit_packs_set_updated_at BEFORE UPDATE ON public.credit_packs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.credit_topups ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.credit_topups ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER credit_topups_set_updated_at BEFORE UPDATE ON public.credit_topups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.data_records ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.data_records ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER data_records_set_updated_at BEFORE UPDATE ON public.data_records FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.data_sync_runs ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.data_sync_runs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER data_sync_runs_set_updated_at BEFORE UPDATE ON public.data_sync_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.decisions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER decisions_set_updated_at BEFORE UPDATE ON public.decisions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.executions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER executions_set_updated_at BEFORE UPDATE ON public.executions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_availability ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.hiring_availability ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_availability_set_updated_at BEFORE UPDATE ON public.hiring_availability FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_candidates ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_candidates_set_updated_at BEFORE UPDATE ON public.hiring_candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_interviews ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_interviews_set_updated_at BEFORE UPDATE ON public.hiring_interviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER hiring_jobs_set_updated_at BEFORE UPDATE ON public.hiring_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_offers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_offers_set_updated_at BEFORE UPDATE ON public.hiring_offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_onboarding ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_onboarding_set_updated_at BEFORE UPDATE ON public.hiring_onboarding FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.hiring_settings ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER hiring_settings_set_updated_at BEFORE UPDATE ON public.hiring_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
