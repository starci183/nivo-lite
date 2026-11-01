import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction } from "./database.client"
import { HttpSecurityEntity } from "./persistence/entities"
import { InjectPrimaryEntityManager } from "./primary.decorators"
import type { RateLimitStore } from "./rate-limit-store.port"

@Injectable()
/** The database function `public.http_rate_limit_consume` serializes each caller's counter across all app replicas in one atomic call. */
export class PostgresRateLimitStoreClient implements RateLimitStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Counts and rolls over in the primary database; a failed store never admits a request. */
    async consume(key: string, windowMs: number, limit: number): Promise<boolean> {
        const [row] = await callDbFunction<{ readonly http_rate_limit_consume?: unknown }>(
            this.entityManager,
            "public.http_rate_limit_consume",
            [key, windowMs, limit],
        )
        return typeof row?.http_rate_limit_consume === "boolean" && row.http_rate_limit_consume
    }

    /** Deletes the one window row of the key in the primary database. */
    async clear(key: string): Promise<void> {
        await this.entityManager.delete(HttpSecurityEntity, { bucketKey: key })
    }
}
