import { QueueModule } from "@modules/platform/queue"
import type { QueueOptions } from "@modules/platform/queue"
import { JobsModule } from "@modules/platform/jobs"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MetaModule } from "@modules/integrations/meta"
import { Secret } from "@modules/platform/config"

/** The producer stays idle until a proof explicitly starts its worker. */
export const queueOptions: QueueOptions = {
    enabled: false,
    redisHost: "redis.invalid",
    redisPort: 6379,
    redisDb: 0,
    prefix: "world-proof",
    concurrency: 1,
    workspaceConcurrency: 1,
    relayIntervalMs: 5,
    relayBatch: 50,
    reconcileAfterMs: 15000,
    visibilityTimeoutMs: 30000,
    shutdownGraceMs: 1000,
    schedulers: [],
}
/** Public modules used by the queue proofs. */
export const QUEUE_MODULES = [QueueModule.register({ ...queueOptions, isGlobal: true })]
/** Public modules used by the claim proofs. */
export const JOBS_MODULES = [
    ...QUEUE_MODULES,
    JobsModule.register({ connection: PRIMARY_ENTITY_MANAGER, workerId: "proof", leaseMs: 100 }),
]
/** The local provider signing key; this is synthetic test data. */
export const signingFixture = "integration-meta-provider-fixture"
/** The real provider verifies and parses every delivery. No provider network operation is needed. */
export const WEBHOOK_MODULES = [
    ...QUEUE_MODULES,
    MetaModule.register({
        app: { appId: "integration-meta", appSecret: new Secret(signingFixture) },
        webhookVerifyToken: undefined,
        loginConfigId: undefined,
        graphVersion: "v21.0",
        siteUrl: undefined,
        channelTokenKey: new Secret("integration-meta-state-fixture"),
        sendPerMinute: 60,
        timeoutMs: 1000,
    }),
]
