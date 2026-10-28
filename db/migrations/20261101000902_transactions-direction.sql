-- Bank moves in both directions: a live SePay delivery that takes money out of the workspace's account (a supplier payment) is
-- recorded as a debit beside the credits, so a paid supplier invoice can be told from an open one. Existing rows are credits.

ALTER TABLE public.transactions
    ADD COLUMN direction text DEFAULT 'credit'::text NOT NULL,
    ADD CONSTRAINT transactions_direction_check CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])));
