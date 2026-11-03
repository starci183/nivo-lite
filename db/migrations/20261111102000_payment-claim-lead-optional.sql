-- payment-claim-lead-optional: a payment claim belongs to the conversation it was said in; the customer may not be a lead yet.
-- Expand only: the lead column accepts null, nothing existing changes.

ALTER TABLE public.payment_claims ALTER COLUMN lead_id DROP NOT NULL;
