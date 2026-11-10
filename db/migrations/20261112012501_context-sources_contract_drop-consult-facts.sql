-- entity-engine partitions: hand-written in the form `cli entities plan --write` prints (W3, context sources); forward-only.
-- Reviewed like a hand-written migration. No transaction control. Contract: applied once the release that stops writing the field is in.
-- Why: `sales.lead.consultFacts` is gone from the declaration. What the consult learns lives in the customer's lead memory (the facts
-- entry `<subject>|$lead|$facts`, written by `lead.update`); the record kept a stale second copy.
-- No backfill: on dev (read 2026-11-11) 2 leads hold the member, none with `careOptOut` true or a non-empty `occasions`; production ran no
-- engine. The guard below refuses to drop a customer's opt-out or occasions silently in any other database.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public."records_sales_lead"
        WHERE data->'consultFacts'->>'careOptOut' = 'true'
           OR (jsonb_typeof(data->'consultFacts'->'occasions') = 'array' AND jsonb_array_length(data->'consultFacts'->'occasions') > 0)
    ) THEN
        RAISE EXCEPTION 'records_sales_lead holds consultFacts with careOptOut or occasions: copy them into lead memory before this migration';
    END IF;
END
$$;

-- drop_constraint public.records_sales_lead:constraint:records_sales_lead_consult_facts_chk: the declaration does not name it
ALTER TABLE public."records_sales_lead" DROP CONSTRAINT "records_sales_lead_consult_facts_chk";
-- strip the member the declaration no longer holds
UPDATE public."records_sales_lead" SET data = data - 'consultFacts' WHERE data ? 'consultFacts';
