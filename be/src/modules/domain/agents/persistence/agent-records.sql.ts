import { sql } from "@modules/platform/database"

/**
 * Ensures an agent by its handle and answers its id ($1 workspace, $2 module, $3 name, $4 handle, $5 role, $6 instructions): a
 * new handle inserts the agent, a known one takes the given module, name, role and instructions. A known agent keeps the NIVO
 * setup block its applied context version wrote ("### NIVO setup v<n>" to "### end NIVO setup"): any block in the given text is
 * dropped and the kept one is appended once, so a re-run never loses the applied setup and never doubles it.
 */
export const UPSERT_AGENT_BY_HANDLE = sql`INSERT INTO public.agents (workspace_id, module, name, handle, role, instructions)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (workspace_id, handle) DO UPDATE
SET module = excluded.module, name = excluded.name, role = excluded.role,
    instructions = concat_ws(
        repeat(chr(10), 2),
        nullif(
            btrim(
                regexp_replace(
                    regexp_replace(excluded.instructions, '### NIVO setup v.*?### end NIVO setup', '', 'g'),
                    '(' || chr(10) || '){3,}', repeat(chr(10), 2), 'g'
                ),
                ' ' || chr(9) || chr(10) || chr(13)
            ),
            ''
        ),
        substring(agents.instructions from '### NIVO setup v.*?### end NIVO setup')
    )
RETURNING id`
