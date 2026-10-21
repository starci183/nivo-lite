import { sql } from "@modules/platform/database"

/** Whether the Hub rooms function of the hub-rooms migration is installed. */
export const ROOMS_FUNCTION_PRESENT = sql`SELECT to_regproc('public.ensure_office_rooms') IS NOT NULL AS present`

/** Creates the department rooms of a workspace and seats its agents ($1 workspace). */
export const ENSURE_OFFICE_ROOMS = sql`SELECT public.ensure_office_rooms($1::uuid)`

/** Moves an agent's home seat to a department room unless it is already there ($1 workspace, $2 room key, $3 agent). */
export const MOVE_AGENT_HOME = sql`SELECT public.move_office_agent_home($1::uuid, $2::text, $3::uuid) AS moved`
