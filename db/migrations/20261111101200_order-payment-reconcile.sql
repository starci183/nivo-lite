-- order-payment-reconcile: Accounting matches a bank credit to the sales order it pays, and keeps the customer's word that they paid until the money is seen.
-- Expand only: one nullable column and one new table, nothing existing changes.
-- transactions.order_id: the sales order a bank credit paid. One transaction pays one order and one order is paid by one transaction (the partial unique index).
-- payment_claims: the ledger of what a customer said ("I transferred 5k, name X") before any matching credit was seen. A claim waits as `open`; an arriving credit
-- that matches settles it (`settled`); one that waited past the configured timeout is given to the owner (`escalated`). dedupe_key makes a repeated message one claim.

ALTER TABLE public.transactions
    ADD COLUMN order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX transactions_order_id_key ON public.transactions USING btree (order_id) WHERE order_id IS NOT NULL;

CREATE TABLE public.payment_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    conversation_id uuid,
    amount_vnd bigint,
    names text[] NOT NULL DEFAULT '{}'::text[],
    body text NOT NULL,
    claimed_at timestamptz NOT NULL DEFAULT now(),
    status text NOT NULL DEFAULT 'open',
    settled_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    dedupe_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT payment_claims_status_check CHECK (status IN ('open', 'settled', 'escalated')),
    CONSTRAINT payment_claims_amount_check CHECK (amount_vnd IS NULL OR amount_vnd > 0)
);
CREATE UNIQUE INDEX payment_claims_dedupe_key ON public.payment_claims USING btree (workspace_id, dedupe_key);
CREATE INDEX payment_claims_open_idx ON public.payment_claims USING btree (workspace_id, claimed_at) WHERE status = 'open';

CREATE TRIGGER payment_claims_set_updated_at BEFORE UPDATE ON public.payment_claims FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_claims_app_be_select ON public.payment_claims FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY payment_claims_app_be_insert ON public.payment_claims FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY payment_claims_app_be_update ON public.payment_claims FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.payment_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_claims TO app_be;
