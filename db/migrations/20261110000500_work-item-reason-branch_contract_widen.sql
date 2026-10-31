-- work-items: an ask that a branch of the action graph raised is recorded under the new reason `branch_ask`, so "send by itself" in
-- the automation gate (which waves through only `over_authority`) cannot wave a named approver through. Additive: the check is
-- widened by one value; no row changes.

ALTER TABLE public.work_items DROP CONSTRAINT work_items_reason_check;
ALTER TABLE public.work_items
    ADD CONSTRAINT work_items_reason_check
    CHECK ((reason = ANY (ARRAY['routine'::text, 'missing_data'::text, 'over_authority'::text, 'unclear_outcome'::text, 'not_allowed'::text, 'branch_ask'::text])));
