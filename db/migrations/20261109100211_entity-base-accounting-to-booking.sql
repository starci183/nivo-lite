-- entity-base-accounting-to-booking: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), accounting_adjustments through bookings (a to k): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at) stamps updated_at, so the application never writes it.
-- Left out on purpose: append-only logs, ledgers and dedupe claims, where an updated_at would be wrong (listed in the entity-base round notes).

ALTER TABLE public.accounting_adjustments ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER accounting_adjustments_set_updated_at BEFORE UPDATE ON public.accounting_adjustments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_conversations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER agent_conversations_set_updated_at BEFORE UPDATE ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_messages ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER agent_messages_set_updated_at BEFORE UPDATE ON public.agent_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agents ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER agents_set_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_generations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER ai_generations_set_updated_at BEFORE UPDATE ON public.ai_generations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_quota_overrides ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER ai_quota_overrides_set_updated_at BEFORE UPDATE ON public.ai_quota_overrides FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.api_keys ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER api_keys_set_updated_at BEFORE UPDATE ON public.api_keys FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.app_commands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER app_commands_set_updated_at BEFORE UPDATE ON public.app_commands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.approval_requests ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER approval_requests_set_updated_at BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.authority ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER authority_set_updated_at BEFORE UPDATE ON public.authority FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.authority_actions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.authority_actions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER authority_actions_set_updated_at BEFORE UPDATE ON public.authority_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.authority_rules ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER authority_rules_set_updated_at BEFORE UPDATE ON public.authority_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.automation_commands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER automation_commands_set_updated_at BEFORE UPDATE ON public.automation_commands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER automation_pipelines_set_updated_at BEFORE UPDATE ON public.automation_pipelines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.automation_runs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER automation_runs_set_updated_at BEFORE UPDATE ON public.automation_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.automation_templates ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER automation_templates_set_updated_at BEFORE UPDATE ON public.automation_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.bank_feed_inbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.bank_feed_inbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER bank_feed_inbox_set_updated_at BEFORE UPDATE ON public.bank_feed_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_exceptions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.booking_exceptions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_exceptions_set_updated_at BEFORE UPDATE ON public.booking_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_reminders ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_reminders_set_updated_at BEFORE UPDATE ON public.booking_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_resources ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_resources_set_updated_at BEFORE UPDATE ON public.booking_resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_services ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_services_set_updated_at BEFORE UPDATE ON public.booking_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_settings ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_settings_set_updated_at BEFORE UPDATE ON public.booking_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.booking_waitlist ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER booking_waitlist_set_updated_at BEFORE UPDATE ON public.booking_waitlist FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plan_usage_tiers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.plan_usage_tiers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER plan_usage_tiers_set_updated_at BEFORE UPDATE ON public.plan_usage_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.plans ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.plans ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
