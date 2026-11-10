-- connector-access-created-at-team-card-update: forward-only; immutable once on origin/main.
-- Two faults of the first real customer turn (run f8a0de0c, 2026-11-10), both between an entity and its table.
--
-- 1. public.mcp_connector_access was created without `created_at` and without the `updated_at` trigger every table carries, while its
--    entity extends the base that maps both. Every read of the access rows failed (42703), and every send to a customer reads them
--    first (the group that owns the channel), so no customer line could leave. The column and the trigger are added; rows that exist
--    take the time of this migration as their creation time.
--
-- 2. public.chat_room_messages gave the application role SELECT and INSERT only: a team line was written once and never changed. The
--    one card of a stopped workflow is now folded in place when the same step stops again or its freeze adds the decisions (the line,
--    its id and its client id stay, so a founder's reply still names the same key), which rewrites the words and the structured
--    content of the line: `body` and `ref`, nothing else. The role gets UPDATE on those two columns only, and the row policy of an
--    update, as the other team-chat tables hold it.

ALTER TABLE public.mcp_connector_access ADD COLUMN created_at timestamp with time zone DEFAULT now() NOT NULL;
CREATE TRIGGER mcp_connector_access_set_updated_at BEFORE UPDATE ON public.mcp_connector_access FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT UPDATE (body, ref) ON TABLE public.chat_room_messages TO app_be;
CREATE POLICY chat_room_messages_app_be_update ON public.chat_room_messages FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));
