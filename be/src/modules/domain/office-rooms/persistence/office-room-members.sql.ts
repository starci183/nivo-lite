import { sql } from "@modules/platform/database"

/**
 * Group members for the whole room page ($1 workspace, $2 department keys). The general Office room includes every active
 * workspace person and every agent, including paused agents. Counts are grouped; only four previews per room reach Auth.
 */
export const LIST_ROOM_MEMBERS = sql`
    WITH room_keys AS (
        SELECT NULL::text AS key
        UNION ALL
        SELECT r.key FROM public.office_rooms r WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
    ), seats AS (
        SELECT NULL::text AS key, m.id, 'human'::text AS kind, m.user_id, m.display_name AS name, m.created_at
        FROM public.workspace_members m WHERE m.workspace_id = $1 AND m.status = 'active'
        UNION ALL
        SELECT NULL::text, a.id, 'agent'::text, NULL::uuid, a.name, a.created_at
        FROM public.agents a WHERE a.workspace_id = $1
        UNION ALL
        SELECT r.key, rm.id, 'human'::text, m.user_id, m.display_name, rm.created_at
        FROM public.office_rooms r
        JOIN public.office_rooms_members rm ON rm.room_id = r.id
        JOIN public.workspace_members m ON m.workspace_id = r.workspace_id AND m.user_id = rm.user_id
        WHERE r.workspace_id = $1 AND r.key = ANY($2::text[]) AND m.status = 'active'
        UNION ALL
        SELECT r.key, rm.id, 'agent'::text, NULL::uuid, a.name, rm.created_at
        FROM public.office_rooms r
        JOIN public.office_rooms_members rm ON rm.room_id = r.id
        JOIN public.agents a ON a.id = rm.agent_id AND a.workspace_id = r.workspace_id
        WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
    ), counts AS (
        SELECT key, count(*)::int AS count FROM seats GROUP BY key
    ), ranked AS (
        SELECT key, id, kind, user_id, name,
               row_number() OVER (PARTITION BY key ORDER BY created_at, id, kind) AS position
        FROM seats
    ), bounded AS (
        SELECT key, id, kind, user_id, name, position FROM ranked WHERE position <= 4
    ), avatars AS MATERIALIZED (
        SELECT id, avatar_url FROM be_access.workspace_member_avatars(
            $1, ARRAY(SELECT DISTINCT user_id FROM bounded WHERE user_id IS NOT NULL))
    ), previews AS (
        SELECT b.key,
               json_agg(json_build_object('name', b.name, 'avatarUrl', a.avatar_url) ORDER BY b.position) AS preview
        FROM bounded b LEFT JOIN avatars a ON a.id = b.user_id
        GROUP BY b.key
    )
    SELECT k.key, COALESCE(c.count, 0) AS count, COALESCE(p.preview, '[]'::json) AS preview
    FROM room_keys k
    LEFT JOIN counts c ON c.key IS NOT DISTINCT FROM k.key
    LEFT JOIN previews p ON p.key IS NOT DISTINCT FROM k.key
    ORDER BY k.key NULLS FIRST
    LIMIT 21`
