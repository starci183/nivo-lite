import type { EnvSource } from "@modules/platform/config"
import type { RedisOptions } from "./redis.options"

/** Reads the Redis options: REDIS_CONNECT_TIMEOUT (10s) is how long a connection may take to reach the server. */
export const parseRedisConfig = (env: EnvSource): RedisOptions => ({
    connectTimeoutMs: env.duration("REDIS_CONNECT_TIMEOUT", 10_000),
})
