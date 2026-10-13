import { sql } from "@modules/platform/database"

/** One module of the registry with its whole definition. */
export const FIND_MODULE = sql`
    SELECT m.key, m.audience, m.multi_instance, m.definition
    FROM public.modules m
    WHERE m.key = $1
    LIMIT 1`

/** One authority action of the registry with the actions its definition queues after it. */
export const FIND_ACTION = sql`
    SELECT a.action, a.module_key, a.max_mode, a.label,
           coalesce(
               (SELECT array_agg(n.value ORDER BY n.ordinality)
                FROM jsonb_array_elements(coalesce(m.definition -> 'authorityActions', m.definition -> 'authority_actions', '[]'::jsonb)) AS e,
                     jsonb_array_elements_text(coalesce(e.value -> 'next', '[]'::jsonb)) WITH ORDINALITY AS n(value, ordinality)
                WHERE e.value ->> 'action' = a.action),
               ARRAY[]::text[]
           ) AS next
    FROM public.authority_actions a
    JOIN public.modules m ON m.key = a.module_key
    WHERE a.action = $1
    LIMIT 1`
