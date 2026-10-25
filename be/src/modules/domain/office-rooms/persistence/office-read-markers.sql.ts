import { sql } from "@modules/platform/database"

/** Advances the existing room read marker to a fetched message's persisted instant ($1 workspace, $2 account, $3 room, $4 persisted instant). */
export const ADVANCE_ROOM_READ_CURSOR = sql`
    INSERT INTO public.office_rooms_reads (workspace_id, user_id, room, last_read_at)
    VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz)
    ON CONFLICT (workspace_id, user_id, room) DO UPDATE
    SET last_read_at = GREATEST(public.office_rooms_reads.last_read_at, EXCLUDED.last_read_at)`
