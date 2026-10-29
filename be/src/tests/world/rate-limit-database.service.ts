import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"
import type {
    RateLimitAccessRow,
    RateLimitBucketRow,
    RateLimitProofAllowedRow,
    RateLimitProofHitsRow,
} from "../fixtures/persistence/rate-limit.rows"

/** Observes the count, deadline and current validity of one isolated proof window. */
const RATE_LIMIT_BUCKET = sql`
    SELECT bucket_key, hits::text AS hits, reset_at, reset_at > statement_timestamp() AS active
    FROM public.http_security WHERE bucket_key = $1
`

/** Moves a proof window to its exact database-clock deadline without waiting for wall time. */
const EXPIRE_RATE_LIMIT_BUCKET = sql`
    UPDATE public.http_security SET reset_at = statement_timestamp() WHERE bucket_key = $1
`

/** Removes only the caller's isolated proof window. */
const CLEAN_RATE_LIMIT_BUCKET = sql`DELETE FROM public.http_security WHERE bucket_key = $1`

/** Exercises the bounded expiry function under the caller's database role. */
const RUN_RATE_LIMIT_CLEANUP = sql`SELECT public.http_rate_limit_cleanup() AS removed`

/** Creates one isolated live window through the backend role's INSERT policy. */
const INSERT_RATE_LIMIT_PROOF_BUCKET = sql`
    INSERT INTO public.http_security (bucket_key, hits, reset_at)
    VALUES ($1, 1, statement_timestamp() + interval '1 minute')
`

/** Exercises the backend role's UPDATE and SELECT policies before expiry. */
const UPDATE_RATE_LIMIT_PROOF_BUCKET = sql`
    WITH changed AS (
        UPDATE public.http_security SET hits = hits + 1 WHERE bucket_key = $1
        RETURNING hits
    )
    SELECT hits::text AS hits FROM changed
`

/** Calls the actual invoker function using the backend role's table policies and cleanup grant. */
const CONSUME_RATE_LIMIT_PROOF_BUCKET = sql`
    SELECT public.http_rate_limit_consume($1::text, $2::double precision, $3::bigint) AS allowed
`

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
    manager.query<Array<RateLimitBucketRow>>(RATE_LIMIT_BUCKET, [key])

/** Moves a proof window to its exact database-clock deadline without waiting for wall time. */
export const expireRateLimitBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query(EXPIRE_RATE_LIMIT_BUCKET, [key])
}

/** Removes only the caller's isolated proof window. */
export const cleanRateLimitBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query(CLEAN_RATE_LIMIT_BUCKET, [key])
}

/** Exercises the bounded expiry function under the manager's database role. */
export const runRateLimitCleanup = async (manager: EntityManager): Promise<void> => {
    await manager.query(RUN_RATE_LIMIT_CLEANUP)
}

/** Creates one isolated live window through the backend role's INSERT policy. */
export const insertRateLimitProofBucket = async (manager: EntityManager, key: string): Promise<void> => {
    await manager.query(INSERT_RATE_LIMIT_PROOF_BUCKET, [key])
}

/** Exercises the backend role's UPDATE and SELECT policies before expiry. */
export const updateRateLimitProofBucket = (
    manager: EntityManager,
    key: string,
): Promise<Array<RateLimitProofHitsRow>> =>
    manager.query<Array<RateLimitProofHitsRow>>(UPDATE_RATE_LIMIT_PROOF_BUCKET, [key])

/** Calls the actual invoker function using the backend role's table policies and cleanup grant. */
export const consumeRateLimitProofBucket = (
    manager: EntityManager,
    key: string,
    windowMs: number,
    limit: number,
): Promise<Array<RateLimitProofAllowedRow>> =>
    manager.query<Array<RateLimitProofAllowedRow>>(CONSUME_RATE_LIMIT_PROOF_BUCKET, [key, windowMs, limit])

/** Reads effective backend and browser access, including privileges inherited from PUBLIC. */
export const rateLimitAccess = (manager: EntityManager): Promise<Array<RateLimitAccessRow>> =>
    manager.query<Array<RateLimitAccessRow>>(RATE_LIMIT_ACCESS)
