import type { EntityManager } from "typeorm"
import { callDbFunction, databaseEntities, sql } from "@modules/platform/database"
import { insertRateLimitWindow } from "../fixtures/builders/rate-limit.builder"
import type {
    RateLimitAccessRow,
    RateLimitBucketRow,
    RateLimitProofAllowedRow,
    RateLimitProofHitsRow,
} from "../fixtures/persistence/rate-limit.rows"

const [HttpSecurityEntity] = databaseEntities

/** How far in the past an expired proof window ends, so the database clock reads it as over whatever its skew. */
const EXPIRED_MS = 1000

/** How long the seeded proof window stays live. */
const LIVE_MS = 60_000

/** Includes inherited PUBLIC grants when checking that browser roles cannot reach counters or rate-limit functions. */
const RATE_LIMIT_ACCESS = sql`
    SELECT
        has_table_privilege('anon', 'public.http_security', 'SELECT,INSERT,UPDATE,DELETE') AS anonymous_data,
        has_table_privilege('authenticated', 'public.http_security', 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_data,
        has_function_privilege('anon', 'public.http_rate_limit_cleanup()', 'EXECUTE') AS anonymous_cleanup,
        has_function_privilege('authenticated', 'public.http_rate_limit_cleanup()', 'EXECUTE') AS authenticated_cleanup,
        has_function_privilege('app_be', 'public.http_rate_limit_cleanup()', 'EXECUTE') AS backend_cleanup,
        has_function_privilege(
            'anon', 'public.http_rate_limit_consume(text,double precision,bigint)', 'EXECUTE'
        ) AS anonymous_consume,
        has_function_privilege(
            'authenticated', 'public.http_rate_limit_consume(text,double precision,bigint)', 'EXECUTE'
        ) AS authenticated_consume,
        has_function_privilege(
            'app_be', 'public.http_rate_limit_consume(text,double precision,bigint)', 'EXECUTE'
        ) AS backend_consume
`

/** Observes the count, deadline and current validity of one isolated proof window. */
export const rateLimitBucket = (manager: EntityManager, key: string): Promise<Array<RateLimitBucketRow>> =>
    manager
        .createQueryBuilder(HttpSecurityEntity, "h")
        .select("h.bucket_key", "bucket_key")
        .addSelect("h.hits", "hits")
        .addSelect("h.reset_at", "reset_at")
        .addSelect("h.reset_at > statement_timestamp()", "active")
        .where("h.bucket_key = :key", { key })
        .getRawMany<RateLimitBucketRow>()

/** Moves a proof window to a deadline already past, without waiting for wall time. */
export const expireRateLimitBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.update(HttpSecurityEntity, { bucketKey: key }, { resetAt: new Date(Date.now() - EXPIRED_MS) })
}

/** Removes only the caller's isolated proof window. */
export const cleanRateLimitBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.delete(HttpSecurityEntity, { bucketKey: key })
}

/** Exercises the bounded expiry function under the manager's database role. */
export const runRateLimitCleanup = async (manager: EntityManager): Promise<void> => {
    await callDbFunction(manager, "public.http_rate_limit_cleanup", [])
}

/** Creates one isolated live window through the backend role's INSERT policy. */
export const insertRateLimitProofBucket = (manager: EntityManager, key: string): Promise<void> =>
    insertRateLimitWindow(manager, key, new Date(Date.now() + LIVE_MS))

const hitsRowOf = (row: unknown): RateLimitProofHitsRow => {
    const hits: unknown = typeof row === "object" && row !== null ? Reflect.get(row, "hits") : null
    return { hits: String(hits) }
}

/** Exercises the backend role's UPDATE and SELECT policies before expiry. */
export const updateRateLimitProofBucket = async (
    manager: EntityManager,
    key: string,
): Promise<Array<RateLimitProofHitsRow>> => {
    const result = await manager
        .createQueryBuilder(HttpSecurityEntity, "h")
        .update()
        .set({ hits: () => "hits + 1" })
        .where("bucket_key = :key", { key })
        .returning("hits")
        .execute()
    const raw: unknown = result.raw
    return Array.isArray(raw) ? raw.map(hitsRowOf) : []
}

/** Calls the actual invoker function using the backend role's table policies and cleanup grant. */
export const consumeRateLimitProofBucket = async (
    manager: EntityManager,
    key: string,
    windowMs: number,
    limit: number,
): Promise<Array<RateLimitProofAllowedRow>> => {
    const rows = await callDbFunction<Readonly<Record<string, boolean>>>(manager, "public.http_rate_limit_consume", [
        key,
        windowMs,
        limit,
    ])
    return rows.map((row) => ({ allowed: row["http_rate_limit_consume"] === true }))
}

/** Reads effective backend and browser access, including privileges inherited from PUBLIC. */
export const rateLimitAccess = (manager: EntityManager): Promise<Array<RateLimitAccessRow>> =>
    manager.query<Array<RateLimitAccessRow>>(RATE_LIMIT_ACCESS)
