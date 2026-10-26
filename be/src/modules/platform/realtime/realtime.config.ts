import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import { redisUrlOf } from "./realtime-address.policy"
import { REDIS_DEFAULT_PREFIX } from "./realtime.contracts"
import type { PostgresRealtimeConfig, RealtimeConfig, RedisRealtimeOptions } from "./realtime.options"

/** The hubs an app can run. */
const HUBS = ["memory", "postgres", "redis"] as const

/** The Redis hub: its address (a secret), database and the prefix of its channel and keys. */
const redisConfigOf = (env: EnvSource): RedisRealtimeOptions => ({
    hub: "redis",
    url: redisUrlOf(env),
    db: env.int("REALTIME_REDIS_DB", 0),
    prefix: env.optional("REALTIME_REDIS_PREFIX") ?? REDIS_DEFAULT_PREFIX,
})

/** The dedicated LISTEN URL as a secret, or none. */
const listenUrlOf = (url: string | undefined): Secret | undefined => (url === undefined ? undefined : new Secret(url))

/** The Postgres hub: the dedicated LISTEN URL when `REALTIME_DB_URL` is declared. */
const postgresConfigOf = (env: EnvSource): PostgresRealtimeConfig => ({
    hub: "postgres",
    listenUrl: listenUrlOf(env.optional("REALTIME_DB_URL")),
})

/** The hub of a config that does not declare one: the Redis hub when Redis is declared (for the hub or the queue), else the Postgres hub. */
const hubDefaultOf = (env: EnvSource): "postgres" | "redis" =>
    env.anyDeclared(["REALTIME_REDIS_URL", "QUEUE_REDIS_HOST"]) ? "redis" : "postgres"

/**
 * Reads the hub from `REALTIME_HUB`; when it is not declared the default follows the declared Redis (lite: `redis` when
 * `REALTIME_REDIS_URL` or the queue's `QUEUE_REDIS_HOST` is declared, else `postgres`). The in-process `memory` hub is never a default, so a scaled deploy cannot fall
 * back to it unseen. A Postgres hub LISTENs on `REALTIME_DB_URL` when it is declared (a direct or session-mode URL, never a
 * transaction pooler), else on the primary database URL; either way the boot probe refuses a connection that does not deliver
 * notifications.
 */
export const parseRealtimeConfig = (env: EnvSource): RealtimeConfig => {
    const hub = env.has("REALTIME_HUB") ? env.enum("REALTIME_HUB", HUBS) : hubDefaultOf(env)
    if (hub === "redis") return redisConfigOf(env)
    return hub === "postgres" ? postgresConfigOf(env) : { hub }
}
