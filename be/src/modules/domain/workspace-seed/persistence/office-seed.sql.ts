import { sql } from "@modules/platform/database"

/** Seats a member in a department room of a workspace; answers false when the room or the member is not of the workspace ($1 workspace, $2 room key, $3 user). */
export const SEAT_PERSON = sql`SELECT public.seat_office_member($1::uuid, $2::text, $3::uuid) AS seated`
