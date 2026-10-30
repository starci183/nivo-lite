-- entity-base-inventory-to-platform: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), identity, inbound, inventory, invoice, job, knowledge and platform tables (a to k): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at) stamps updated_at, so the application never writes it.
-- Left out on purpose: append-only logs, ledgers and dedupe claims, where an updated_at would be wrong (listed in the entity-base round notes).

ALTER TABLE public.identity_password_tokens ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.identity_password_tokens ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER identity_password_tokens_set_updated_at BEFORE UPDATE ON public.identity_password_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.identity_refresh_tokens ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.identity_refresh_tokens ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER identity_refresh_tokens_set_updated_at BEFORE UPDATE ON public.identity_refresh_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inbound_events ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inbound_events_set_updated_at BEFORE UPDATE ON public.inbound_events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER inventory_items_set_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_locations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_locations_set_updated_at BEFORE UPDATE ON public.inventory_locations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_po_lines ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.inventory_po_lines ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_po_lines_set_updated_at BEFORE UPDATE ON public.inventory_po_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER inventory_purchase_orders_set_updated_at BEFORE UPDATE ON public.inventory_purchase_orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_recipe_lines ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.inventory_recipe_lines ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_recipe_lines_set_updated_at BEFORE UPDATE ON public.inventory_recipe_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_recipes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_recipes_set_updated_at BEFORE UPDATE ON public.inventory_recipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_stock_levels ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_stock_levels_set_updated_at BEFORE UPDATE ON public.inventory_stock_levels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_suppliers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER inventory_suppliers_set_updated_at BEFORE UPDATE ON public.inventory_suppliers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invoices ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.job_outbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER job_outbox_set_updated_at BEFORE UPDATE ON public.job_outbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.jobs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.jobs ALTER COLUMN updated_at SET DEFAULT now();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_chunks ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER knowledge_chunks_set_updated_at BEFORE UPDATE ON public.knowledge_chunks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_gaps ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER knowledge_gaps_set_updated_at BEFORE UPDATE ON public.knowledge_gaps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER knowledge_sources_set_updated_at BEFORE UPDATE ON public.knowledge_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.knowledge_suggestion_state ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.knowledge_suggestion_state ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER knowledge_suggestion_state_set_updated_at BEFORE UPDATE ON public.knowledge_suggestion_state FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
