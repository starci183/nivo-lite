import type { EntityManager } from "typeorm"
import { databaseEntities } from "@modules/platform/database"

const [HttpSecurityEntity] = databaseEntities

/** Creates one isolated rate-limit window with a single hit that ends at `resetAt`; the manager's role decides whether the INSERT policy admits it. */
export const insertRateLimitWindow = async (manager: EntityManager, key: string, resetAt: Date): Promise<void> => {
    await manager.insert(HttpSecurityEntity, { bucketKey: key, hits: "1", resetAt })
}
