-- entity-base-set-updated-at: forward-only; immutable once on origin/main.
-- The shared updated_at trigger function behind AbstractEntity (BE-PERSISTENCE-3): a BEFORE UPDATE trigger stamps updated_at = now(),
-- so the application never writes the column. CREATE OR REPLACE keeps it safe whichever migration of the entity-base round runs first.
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;

-- A trigger function is fired by the table's trigger, which does not check EXECUTE; closed to the browser roles like every other trigger function.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Lead, loyalty, MCP, meta and module tables (l to m): created_at and updated_at as timestamptz NOT NULL DEFAULT now() with the update trigger.
-- Left out on purpose: loyalty_ledger and module_context_versions (immutable by trigger), mcp_call_log and module_setup_messages (append-only logs).
CREATE TRIGGER lead_actions_set_updated_at BEFORE UPDATE ON public.lead_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER lead_flows_set_updated_at BEFORE UPDATE ON public.lead_flows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_campaigns ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER loyalty_campaigns_set_updated_at BEFORE UPDATE ON public.loyalty_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_customer_links ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER loyalty_customer_links_set_updated_at BEFORE UPDATE ON public.loyalty_customer_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER loyalty_customers_set_updated_at BEFORE UPDATE ON public.loyalty_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER loyalty_programs_set_updated_at BEFORE UPDATE ON public.loyalty_programs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_rewards ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER loyalty_rewards_set_updated_at BEFORE UPDATE ON public.loyalty_rewards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_sends ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER loyalty_sends_set_updated_at BEFORE UPDATE ON public.loyalty_sends FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.loyalty_otps ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER loyalty_otps_set_updated_at BEFORE UPDATE ON public.loyalty_otps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER mcp_connectors_set_updated_at BEFORE UPDATE ON public.mcp_connectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mcp_gateway_receipts ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.mcp_gateway_receipts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER mcp_gateway_receipts_set_updated_at BEFORE UPDATE ON public.mcp_gateway_receipts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.mcp_tool_grants ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER mcp_tool_grants_set_updated_at BEFORE UPDATE ON public.mcp_tool_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.member_grants ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER member_grants_set_updated_at BEFORE UPDATE ON public.member_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.messages ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER messages_set_updated_at BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_comments ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.meta_comments ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER meta_comments_set_updated_at BEFORE UPDATE ON public.meta_comments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_inbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.meta_inbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER meta_inbox_set_updated_at BEFORE UPDATE ON public.meta_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meta_threads ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.meta_threads ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER meta_threads_set_updated_at BEFORE UPDATE ON public.meta_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.module_context_notes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER module_context_notes_set_updated_at BEFORE UPDATE ON public.module_context_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.module_installations ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER module_installations_set_updated_at BEFORE UPDATE ON public.module_installations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.modules ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER modules_set_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.module_setup_sessions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER module_setup_sessions_set_updated_at BEFORE UPDATE ON public.module_setup_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.module_setup_writes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER module_setup_writes_set_updated_at BEFORE UPDATE ON public.module_setup_writes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

