import { sql } from "@modules/platform/database"

/** Sends a private server-authored broadcast ($1 topic, $2 event, $3 JSON payload). */
export const PUBLISH_PRIVATE_BROADCAST = sql`SELECT be_access.broadcast_private($1::text, $2::text, $3::jsonb) LIMIT 1`
