-- Soft uninstall ("Gỡ agent"): an installed agent can end in the terminal status `removed`. The row stays, so its conversations,
-- messages, context versions and knowledge keep their history; nothing runs, and it leaves every list. Re-installing the same role
-- makes a new installation, so the two unique indexes that guard a type (one instance of a single type, one label per type) must not
-- count removed rows. Additive: the status check is widened, two nullable columns are added, the indexes are rebuilt as partial ones.
-- `status` is a text column with a CHECK, not a Postgres enum, so no ADD VALUE is involved and the new value is usable at once.

ALTER TABLE public.module_installations DROP CONSTRAINT module_installations_status_check;
ALTER TABLE public.module_installations
    ADD CONSTRAINT module_installations_status_check
    CHECK ((status = ANY (ARRAY['installing'::text, 'setup'::text, 'ready'::text, 'live'::text, 'paused'::text, 'needs_connection'::text, 'removed'::text])));

ALTER TABLE public.module_installations ADD COLUMN removed_at timestamp with time zone;
ALTER TABLE public.module_installations ADD COLUMN removed_by text;
ALTER TABLE public.module_installations
    ADD CONSTRAINT module_installations_removed_check
    CHECK (((status = 'removed'::text) = (removed_at IS NOT NULL)));

DROP INDEX public.module_installations_name_unique;
CREATE UNIQUE INDEX module_installations_name_unique
    ON public.module_installations USING btree (workspace_id, module_key, lower(name)) WHERE (status <> 'removed'::text);

DROP INDEX public.module_installations_single;
CREATE UNIQUE INDEX module_installations_single
    ON public.module_installations USING btree (workspace_id, module_key) WHERE ((NOT is_multi) AND (status <> 'removed'::text));
