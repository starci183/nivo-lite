-- agent-roles-many: forward-only; immutable once on origin/main.
-- One role, many agents (owner ruling 2026-11-09): a role such as Sales may run several installed agents, each with its own name, handle,
-- picture and channels. Additive only: one nullable column for the chosen preset picture, and the Sales role marked multi-instance (its
-- existing installations follow, so each one keeps its own graph, knowledge and setup scope).

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar_preset text;
DO $avatar_preset_check$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'agents_avatar_preset_check' AND conrelid = 'public.agents'::regclass
    ) THEN
        ALTER TABLE public.agents ADD CONSTRAINT agents_avatar_preset_check
            CHECK (avatar_preset IS NULL OR avatar_preset ~ '^[a-z][a-z0-9-]{1,39}$');
    END IF;
END;
$avatar_preset_check$;

UPDATE public.modules SET multi_instance = true WHERE key = 'sales' AND NOT multi_instance;
UPDATE public.module_installations SET is_multi = true WHERE module_key = 'sales' AND NOT is_multi;
