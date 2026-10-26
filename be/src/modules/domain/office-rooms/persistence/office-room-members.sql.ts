import { sql } from "@modules/platform/database"

/**
 * Group members for the whole room page ($1 workspace, $2 department keys). The general Office room includes every active
 * workspace account and every agent, including paused agents. Departments without active person seats include the active
 * owners and managers. Counts are grouped; only four previews per room reach Auth. An agent's picture is its own column.
 */
export const LIST_ROOM_MEMBERS = sql`
    WITH room_keys AS (
        SELECT NULL::text AS key
        UNION ALL
        SELECT r.key FROM public.office_rooms r WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
    ), people AS (
        SELECT m.id AS seat_id, m.user_id AS id, m.display_name AS name, m.role, m.created_at
        FROM public.workspace_members m WHERE m.workspace_id = $1 AND m.status = 'active'
    ), department_people AS (
        SELECT r.key, rm.id AS seat_id, m.id, m.name, rm.created_at
        FROM public.office_rooms r
        JOIN public.office_rooms_members rm ON rm.room_id = r.id
        JOIN people m ON m.id = rm.user_id
        WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
    ), seats AS (
        SELECT NULL::text AS key, m.seat_id, m.id, 'human'::text AS kind, m.id AS user_id,
               m.name, NULL::text AS module, NULL::text AS agent_avatar_url, m.created_at
        FROM people m
        UNION ALL
        SELECT NULL::text, a.id, a.id, 'agent'::text, NULL::uuid, a.name, a.module, a.avatar_url, a.created_at
        FROM public.agents a WHERE a.workspace_id = $1
        UNION ALL
        SELECT m.key, m.seat_id, m.id, 'human'::text, m.id, m.name, NULL::text, NULL::text, m.created_at
        FROM department_people m
        UNION ALL
        SELECT r.key, m.seat_id, m.id, 'human'::text, m.id, m.name, NULL::text, NULL::text, m.created_at
        FROM public.office_rooms r
        CROSS JOIN people m
        WHERE r.workspace_id = $1 AND r.key = ANY($2::text[]) AND m.role IN ('owner', 'manager')
          AND NOT EXISTS (SELECT 1 FROM department_people p WHERE p.key = r.key)
        UNION ALL
        SELECT r.key, rm.id, a.id, 'agent'::text, NULL::uuid, a.name, a.module, a.avatar_url, rm.created_at
        FROM public.office_rooms r
        JOIN public.office_rooms_members rm ON rm.room_id = r.id
        JOIN public.agents a ON a.id = rm.agent_id AND a.workspace_id = r.workspace_id
        WHERE r.workspace_id = $1 AND r.key = ANY($2::text[])
    ), counts AS (
        SELECT key, count(*)::int AS count FROM seats GROUP BY key
    ), ranked AS (
        SELECT key, id, kind, user_id, name, module, agent_avatar_url,
               row_number() OVER (PARTITION BY key ORDER BY created_at, seat_id, kind) AS position
        FROM seats
    ), bounded AS (
        SELECT key, id, kind, user_id, name, module, agent_avatar_url, position FROM ranked WHERE position <= 4
    ), avatars AS MATERIALIZED (
        SELECT id, avatar_url FROM be_access.workspace_member_avatars(
            $1, ARRAY(SELECT DISTINCT user_id FROM bounded WHERE user_id IS NOT NULL))
    ), previews AS (
        SELECT b.key,
               json_agg(json_build_object('id', b.id, 'kind', b.kind, 'module', b.module,
                   'name', b.name, 'avatarUrl', COALESCE(a.avatar_url, b.agent_avatar_url)) ORDER BY b.position) AS preview
        FROM bounded b LEFT JOIN avatars a ON a.id = b.user_id
        GROUP BY b.key
    )
    SELECT k.key, COALESCE(c.count, 0) AS count, COALESCE(p.preview, '[]'::json) AS preview
    FROM room_keys k
    LEFT JOIN counts c ON c.key IS NOT DISTINCT FROM k.key
    LEFT JOIN previews p ON p.key IS NOT DISTINCT FROM k.key
    ORDER BY k.key NULLS FIRST`
