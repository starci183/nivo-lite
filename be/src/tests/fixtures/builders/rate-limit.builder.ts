import type { EntityManager } from "typeorm"
import { INSERT_RATE_LIMIT_PROOF_BUCKET } from "./rate-limit.sql"

/** Creates one isolated live window through the backend role's INSERT policy. */
export const insertRateLimitProofBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query(INSERT_RATE_LIMIT_PROOF_BUCKET, [key])
}
