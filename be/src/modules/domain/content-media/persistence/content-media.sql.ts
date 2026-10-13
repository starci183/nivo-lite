import { sql } from "@modules/platform/database"

/** Allocates the unique name of one upload object through the app's primary database. */
export const NEW_CONTENT_MEDIA_UPLOAD_ID = sql`SELECT gen_random_uuid()::text AS id`
