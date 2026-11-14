-- drop-template-marketplace: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the ENGINE-CLEAN-1 worker: the restart
-- owner applies it. Owner ruling R67 (2026-11-14): the template marketplace is REMOVED, no package replaces it. Its domain
-- (`template-marketplace`: listings, review queue, likeness grants, creator ledger, paid-listing settlement), its GraphQL operations, the
-- web pages (Chợ agent, Mẫu của tôi, the packaging page) and the template store it sold (`agent-templates`: packaged versions, installs,
-- licences, whose only callers were the marketplace operations) left the source. No other table references these tables
-- (`agent_template_versions` -> `agent_templates` and `template_installs` -> `template_licenses` are inside the set and go with it).

DROP TABLE IF EXISTS public.creator_ledger_entries;
DROP TABLE IF EXISTS public.template_likeness_grants;
DROP TABLE IF EXISTS public.template_listings;
DROP TABLE IF EXISTS public.template_installs;
DROP TABLE IF EXISTS public.template_licenses;
DROP TABLE IF EXISTS public.agent_template_versions;
DROP TABLE IF EXISTS public.agent_templates;

-- `payment_orders.kind = 'agent_template'`: the order of a paid listing. Nothing writes it any more; the CHECK loses the member. A row of
-- that kind would make the new CHECK fail, so the file refuses (and rolls back) while one exists: the restart owner reads the rows and
-- decides by hand (none is expected: the paid-listing settlement was never bound in production).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.payment_orders WHERE kind = 'agent_template') THEN
    RAISE EXCEPTION 'drop-template-marketplace: payment_orders still holds kind agent_template rows; settle them by hand first';
  END IF;
END
$$;
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_kind_check;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_kind_check CHECK (kind IN ('plan', 'upgrade', 'topup', 'credit_pack'));
