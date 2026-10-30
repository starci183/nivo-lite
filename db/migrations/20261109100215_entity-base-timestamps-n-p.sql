-- entity-base-timestamps-n-p: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), n8n through public_api (n to p): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at, created by
-- 20261109100202_entity-base-set-updated-at) stamps updated_at, so the application never writes it.
-- Left out on purpose: platform_audit (an append-only audit log).

ALTER TABLE public.n8n_platform_config ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.n8n_platform_config ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER n8n_platform_config_set_updated_at BEFORE UPDATE ON public.n8n_platform_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.n8n_runs ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER n8n_runs_set_updated_at BEFORE UPDATE ON public.n8n_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nivo_knowledge ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER nivo_knowledge_set_updated_at BEFORE UPDATE ON public.nivo_knowledge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_command_candidates ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER office_command_candidates_set_updated_at BEFORE UPDATE ON public.office_command_candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_rooms ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER office_rooms_set_updated_at BEFORE UPDATE ON public.office_rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_rooms_members ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER office_rooms_members_set_updated_at BEFORE UPDATE ON public.office_rooms_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_rooms_pins ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER office_rooms_pins_set_updated_at BEFORE UPDATE ON public.office_rooms_pins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.office_rooms_reads ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.office_rooms_reads ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER office_rooms_reads_set_updated_at BEFORE UPDATE ON public.office_rooms_reads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.openclaw_agent_sync ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.openclaw_agent_sync ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER openclaw_agent_sync_set_updated_at BEFORE UPDATE ON public.openclaw_agent_sync FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orders ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_order_requests ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER payment_order_requests_set_updated_at BEFORE UPDATE ON public.payment_order_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_orders ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER payment_orders_set_updated_at BEFORE UPDATE ON public.payment_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.public_api ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER public_api_set_updated_at BEFORE UPDATE ON public.public_api FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

