import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"

/** Creates one isolated live window through the backend role's INSERT policy. The window table is not an entity of the app. */
const INSERT_RATE_LIMIT_PROOF_BUCKET = sql`
    INSERT INTO public.http_security (bucket_key, hits, reset_at)
    VALUES ($1, 1, statement_timestamp() + interval '1 minute')
`

/** Creates one isolated live window through the backend role's INSERT policy. */
export const insertRateLimitProofBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query(INSERT_RATE_LIMIT_PROOF_BUCKET, [key])
}
