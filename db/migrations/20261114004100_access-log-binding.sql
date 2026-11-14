-- access-log-binding: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by E-FIX9 (source only): the restart owner applies it with the code that writes it.
-- The access log records the one access an agent holds on a connection under the rights model (concept rights: rights = account
-- attachments + each node's one auto|ask mode; no per-pair access level): the pair is BOUND, or it is not. A change is a binding made
-- (before NULL, after 'bound') or removed (before 'bound', after NULL). The old checks still allowed the retired per-pair levels
-- read | ask | auto, which no code writes any more, and refused 'bound', so every binding failed (MX-CORE D2-1).
-- This REPLACES the vocabulary (it does not widen it): the retired levels are no longer allowed. A row written under the old model with
-- a level recorded that the pair held access at all, i.e. it was bound: it is rewritten to 'bound' (dev holds 0 rows).
ALTER TABLE public.agent_access_log DROP CONSTRAINT agent_access_log_after_access_check;
ALTER TABLE public.agent_access_log DROP CONSTRAINT agent_access_log_before_access_check;
UPDATE public.agent_access_log SET after_access = 'bound' WHERE after_access IS NOT NULL AND after_access <> 'bound';
UPDATE public.agent_access_log SET before_access = 'bound' WHERE before_access IS NOT NULL AND before_access <> 'bound';
ALTER TABLE public.agent_access_log ADD CONSTRAINT agent_access_log_after_access_check CHECK (((after_access IS NULL) OR (after_access = 'bound'::text)));
ALTER TABLE public.agent_access_log ADD CONSTRAINT agent_access_log_before_access_check CHECK (((before_access IS NULL) OR (before_access = 'bound'::text)));
