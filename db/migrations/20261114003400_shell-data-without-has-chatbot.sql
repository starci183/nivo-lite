-- shell-data-without-has-chatbot: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the ENGINE-CLEAN-1 worker: the
-- restart owner applies it. Engine cleanup wave 1 (DOMAIN-AUDIT item 4): `shell_data().has_chatbot` named one business module
-- (`agents.module = 'chatbot'`) in an engine function and had no reader in the web app; the mapper member, the GraphQL field
-- `WorkspaceShell.hasChatbot` and the fixture left the source. The function keeps its signature, owner, grants and the other two members.

CREATE OR REPLACE FUNCTION public.shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'agents', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'module', a.module, 'status', a.status) order by a.created_at)
                        from agents a where a.workspace_id = ws), '[]'::jsonb),
    'is_founding_member', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'module.purchased'
                                  and e.created_at >= founding_from and e.created_at <= founding_to)
  );
$$;
