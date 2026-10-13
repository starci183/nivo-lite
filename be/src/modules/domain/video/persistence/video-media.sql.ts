import { sql } from "@modules/platform/database"

/** Generates an upload identity through the injected database connection. */
export const SELECT_VIDEO_MEDIA_ID = sql`SELECT gen_random_uuid() AS id`
