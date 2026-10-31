import type { DynamicModule } from "@nestjs/common"
import { EnvSource } from "@modules/platform/config"
import type { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule } from "@modules/platform/queue"
import type { QueueOptions } from "@modules/platform/queue"
import { queueOptions } from "./test-capabilities.options"

/** The password of the private Redis when it demands one; none when the variable is not set. */
const redisPasswordOfProof = (): Secret | undefined => {
    const env = EnvSource.fromProcess()
    return env.has("QUEUE_REDIS_PASSWORD") ? env.secret("QUEUE_REDIS_PASSWORD") : undefined
}

/** Real broker proofs require an explicitly selected private, loopback Redis port. */
export const redisProofOptions = (prefix: string): QueueOptions => ({
    ...queueOptions,
    enabled: true,
    redisHost: "127.0.0.1",
    redisPort: EnvSource.fromProcess().int("QUEUE_REDIS_PORT"),
    redisPassword: redisPasswordOfProof(),
    prefix,
    visibilityTimeoutMs: 2000,
    shutdownGraceMs: 1000,
})

/** The queue capability over the private Redis, under a prefix no other proof shares. */
export const redisQueueModules = (prefix: string): ReadonlyArray<DynamicModule> => [
    QueueModule.register({ ...redisProofOptions(prefix), isGlobal: true }),
]

/** The queue over the private Redis plus the fenced job runner, whose claim leases last `leaseMs`. */
export const redisJobsModules = (prefix: string, leaseMs: number): ReadonlyArray<DynamicModule> => [
    ...redisQueueModules(prefix),
    JobsModule.register({
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "successor",
        leaseMs,
        scheduler: { enabled: false },
    }),
]
