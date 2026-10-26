import { Secret } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"

/**
 * The address of the Redis hub: the secret `REALTIME_REDIS_URL` when it is declared (any Redis, with its ACL user and `rediss://`), else
 * the Redis the app already declares for its queue (`QUEUE_REDIS_HOST`, `QUEUE_REDIS_PORT` and the optional sealed `QUEUE_REDIS_PASSWORD`),
 * so the hub adds no secret of its own and shares that server under its own `REALTIME_REDIS_PREFIX`.
 */
export const redisUrlOf = (env: EnvSource): Secret => {
    const own = env.optional("REALTIME_REDIS_URL")
    if (own !== undefined) return new Secret(own)
    const host = env.string("QUEUE_REDIS_HOST")
    const port = env.int("QUEUE_REDIS_PORT", 6379)
    const queuePassword = env.optional("QUEUE_REDIS_PASSWORD")
    const password = queuePassword === undefined ? "" : `:${encodeURIComponent(queuePassword)}@`
    return new Secret(`redis://${password}${host}:${port}`)
}
