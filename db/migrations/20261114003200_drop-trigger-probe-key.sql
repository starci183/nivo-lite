-- drop-trigger-probe-key: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the ENGINE-CLEAN-1 worker: the restart
-- owner applies it. Engine cleanup wave 1 (rulings R67, R75; DOMAIN-AUDIT item 1): the probes of the wake engine (tasks-due,
-- new-documents, accounting-close) are deleted. `AgentProbesService.decide` had no production caller (only a test world), so no live
-- wake ever decided on a probe; the probe key of a trigger, its GraphQL field and the clock tick's `probeKey` member left the source.
-- The business check of a close of the books belongs to the package that runs it (a clock trigger its graph registers).

ALTER TABLE public.agent_triggers DROP COLUMN IF EXISTS probe_key;
