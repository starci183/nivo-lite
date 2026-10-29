import { sql } from "@modules/platform/database"

/** A browser trying to place an object in the avatars bucket itself ($1 object name). */
export const BROWSER_WRITE_AVATAR = sql`INSERT INTO storage.objects (bucket_id, name) VALUES ('avatars_public', $1)`
