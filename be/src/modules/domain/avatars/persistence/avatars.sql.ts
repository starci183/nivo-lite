import { sql } from "@modules/platform/database"

/** Allocates the unique name of one picture object through the app's primary database. */
export const NEW_AVATAR_OBJECT_ID = sql`SELECT gen_random_uuid()::text AS id LIMIT 1`
