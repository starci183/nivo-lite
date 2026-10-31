-- supplier-payables: the shop's supplier invoices as a record. Expand only: one new table, nothing existing altered.
-- Each morning the accounting desk lists the supplier invoices through the gateway and keeps each one here as open; an outgoing
-- payment that settles one (alone, or approved by a person) marks the row paid, and a paid row is an expense line of the ledger.
-- The workbench reads this table and never the gateway, so a page load writes nothing.

CREATE TABLE public.supplier_payables (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    supplier text NOT NULL DEFAULT '',
    seller_tax_code text NOT NULL,
    invoice_no text NOT NULL,
    amount_vnd bigint NOT NULL,
    issued_on date NOT NULL,
    due_on date NOT NULL,
    status text NOT NULL DEFAULT 'open',
    debit_ref text,
    paid_at timestamptz,
    work_item_id uuid REFERENCES public.work_items(id) ON DELETE SET NULL,
    first_seen_at timestamptz NOT NULL DEFAULT now(),
    decided_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT supplier_payables_status_check CHECK (status IN ('open', 'paid')),
    CONSTRAINT supplier_payables_amount_check CHECK (amount_vnd >= 0),
    CONSTRAINT supplier_payables_paid_check CHECK (status = 'open' OR (paid_at IS NOT NULL AND debit_ref IS NOT NULL)),
    CONSTRAINT supplier_payables_invoice_key UNIQUE (workspace_id, seller_tax_code, invoice_no)
);
CREATE INDEX supplier_payables_open_idx ON public.supplier_payables USING btree (workspace_id, due_on) WHERE status = 'open';
CREATE INDEX supplier_payables_paid_idx ON public.supplier_payables USING btree (workspace_id, paid_at DESC) WHERE status = 'paid';

CREATE TRIGGER supplier_payables_set_updated_at BEFORE UPDATE ON public.supplier_payables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.supplier_payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_payables_app_be_select ON public.supplier_payables FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY supplier_payables_app_be_insert ON public.supplier_payables FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY supplier_payables_app_be_update ON public.supplier_payables FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.supplier_payables FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.supplier_payables TO app_be;
