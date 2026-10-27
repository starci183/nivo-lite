-- Contract renewal invoices: a renewal bills the customer for the next term of a contract, so an invoice can now name the contract
-- it renews and the contract end date (`period_ends_on`) that this payment extends. Both columns are nullable; every existing
-- invoice (an order invoice or a free-standing one) keeps null in both and is unchanged. Deleting a contract keeps its invoices and
-- clears the link, as the lead and order links already do; a linked invoice must carry its period, or the index below could
-- not tell two renewals apart. One renewal invoice per contract period: the partial unique index lets
-- the issuer insert with ON CONFLICT DO NOTHING and read the existing invoice back, so a retried renewal never bills twice.
-- Additive only: row-level policies and table grants on public.invoices already cover new columns, so none change here.

ALTER TABLE public.invoices
    ADD COLUMN contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN period_ends_on date;
ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_contract_period_check CHECK (((contract_id IS NULL) OR (period_ends_on IS NOT NULL)));

CREATE UNIQUE INDEX invoices_one_per_contract_period
    ON public.invoices USING btree (workspace_id, contract_id, period_ends_on) WHERE (contract_id IS NOT NULL);
