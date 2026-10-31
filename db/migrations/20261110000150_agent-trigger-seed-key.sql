-- A module seeds the triggers of its agent by a stable key, so installing or applying the module again finds the row it wrote instead of
-- adding a second one, and a base graph can name the trigger by that key. A trigger the owner wrote has no key.
ALTER TABLE public.agent_triggers ADD COLUMN seed_key text;
CREATE UNIQUE INDEX agent_triggers_seed_key_idx ON public.agent_triggers USING btree (agent_id, seed_key) WHERE seed_key IS NOT NULL;
