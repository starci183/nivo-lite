-- wake-scope-key: forward-only; immutable once on origin/main. Written by RESTART-R2 (2026-11-14) at the first live delivery.
-- The one event pipeline locks a keyed event's work on `key:<path>=<value>` (provider-triggers/trigger-delivery.policy.ts
-- `scopeKeyOfEvent`, KEY_SCOPE_PREFIX "key:"); the baseline's checks on public.agent_wakes and public.agent_work_leases still allowed only
-- `agent` and `conversation:<id>`, so every delivered customer event was refused by the database (`agent_wakes_scope_check`) and its job
-- retried. The checks now also allow the keyed scope. Expand-only: every existing row already satisfies the narrower check.
ALTER TABLE public.agent_wakes DROP CONSTRAINT agent_wakes_scope_check;
ALTER TABLE public.agent_wakes ADD CONSTRAINT agent_wakes_scope_check
    CHECK (scope_key = 'agent' OR scope_key LIKE 'conversation:%' OR scope_key LIKE 'key:%');
ALTER TABLE public.agent_work_leases DROP CONSTRAINT agent_work_leases_scope_check;
ALTER TABLE public.agent_work_leases ADD CONSTRAINT agent_work_leases_scope_check
    CHECK (scope_key = 'agent' OR scope_key LIKE 'conversation:%' OR scope_key LIKE 'key:%');
