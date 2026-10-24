import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "./primary.decorators"
import type { RateLimitRow } from "./persistence/rate-limit.rows"
import { RATE_LIMIT_CONSUME } from "./persistence/rate-limit.sql"
import type { RateLimitStore } from "./rate-limit-store.port"

@Injectable()
/** A single PostgreSQL upsert serializes each caller's counter across all app replicas. */
export class PostgresRateLimitStoreClient implements RateLimitStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Counts and rolls over in the primary database; a failed store never admits a request. */
    async consume(key: string, windowMs: number, limit: number): Promise<boolean> {
        const rows = await this.entityManager.query<Array<RateLimitRow>>(RATE_LIMIT_CONSUME, [key, windowMs, limit])
        return rows[0]?.allowed === true
    }
}
