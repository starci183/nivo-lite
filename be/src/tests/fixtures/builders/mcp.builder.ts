import { fakeIds } from "@starci/jest-preset"
import type { InjectionToken } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import { QueueModule } from "@modules/platform/queue"

const PRIMARY_DATA_SOURCE = "primaryDataSource"
const wiringIds = fakeIds()

/** Refuses infrastructure operations during construction of the module graph. */
const refuseWiringOperation = (): never => {
    throw new HttpError({ code: HttpErrorCode.Network })
}

/** Synthetic settings of the mcp app; no environment source is read and no credential is held. */
const options = {
    server: { port: 8790 },
    httpSecurity: {
        trustedProxyHops: 0,
        allowedOrigins: ["https://site.invalid"],
        rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
        webhooks: {},
    },
    database: {
        name: "primary",
        provider: "postgres" as const,
        url: new Secret(`postgresql://wiring:${wiringIds.next()}@database.invalid:5432/wiring`),
        schema: "public",
    },
    queue: {
        enabled: false,
        redisHost: "redis.invalid",
        redisPort: 6379,
        redisDb: 0,
        prefix: "wiring",
        concurrency: 1,
        workspaceConcurrency: 1,
        relayIntervalMs: 500,
        relayBatch: 50,
        reconcileAfterMs: 15000,
        visibilityTimeoutMs: 60000,
        shutdownGraceMs: 1000,
    },
    connectionSecrets: { tokenKey: new Secret(Buffer.alloc(32, 9).toString("base64")) },
    toolsConfig: { defaultTimeoutMs: 4000 },
    ai: { gatewayUrl: null, virtualKey: null, chatModel: "work", embeddingModel: "embed" },
    // No vector index in a proof: vectors stay in Postgres (the one switch is QDRANT_URL).
    qdrant: { url: null, apiKey: null, timeoutMs: 5000 },
    sepay: { apiBase: "https://sepay.invalid", timeoutMs: 1000 },
    entityEngine: { cursorKey: new Secret(Buffer.alloc(32, 9).toString("base64")), buildId: undefined },
}

/** The existing database and queue tokens of the real registered modules, each answered by a double that refuses to run. */
const resourceOverrides = (): Array<{ token: InjectionToken; value: unknown }> => {
    const manager = { query: refuseWiringOperation, transaction: refuseWiringOperation }
    const transport = {
        add: refuseWiringOperation,
        stateOf: refuseWiringOperation,
        republish: refuseWiringOperation,
        work: refuseWiringOperation,
        wait: refuseWiringOperation,
        close: refuseWiringOperation,
    }
    const queueTokens = (QueueModule.register({ ...options.queue, schedulers: [] }).providers ?? []).flatMap(
        (provider) => {
            const token = typeof provider === "function" ? provider : provider.provide
            let name: string | undefined
            if (typeof token === "symbol") name = token.description
            if (typeof token === "function") name = token.name
            return name === "platform.queue.transport" || name === "BullmqQueueTransportClient"
                ? [{ token, value: transport }]
                : []
        },
    )
    return [
        {
            token: PRIMARY_DATA_SOURCE,
            value: {
                manager,
                isInitialized: true,
                subscribers: [],
                query: refuseWiringOperation,
                createQueryRunner: refuseWiringOperation,
            },
        },
        { token: PRIMARY_ENTITY_MANAGER, value: manager },
        ...queueTokens,
    ]
}

type BuildWiringProofResultOverridesShape = {
    token: InjectionToken
    value: unknown
}

type BuildWiringProofResultOptionsAiShape = {
    gatewayUrl: null
    virtualKey: null
    chatModel: string
    embeddingModel: string
}

type BuildWiringProofResultOptionsQdrantShape = {
    url: string | null
    apiKey: null
    timeoutMs: number
}

type BuildWiringProofResultOptionsToolsConfigShape = {
    defaultTimeoutMs: number
}

type BuildWiringProofResultOptionsConnectionSecretsShape = {
    tokenKey: Secret
}

type BuildWiringProofResultOptionsQueueShape = {
    enabled: boolean
    redisHost: string
    redisPort: number
    redisDb: number
    prefix: string
    concurrency: number
    workspaceConcurrency: number
    relayIntervalMs: number
    relayBatch: number
    reconcileAfterMs: number
    visibilityTimeoutMs: number
    shutdownGraceMs: number
}

type BuildWiringProofResultOptionsDatabaseShape = {
    name: string
    provider: "postgres"
    url: Secret
    schema: string
}

type BuildWiringProofResultOptionsHttpSecurityWebhooksShape = {}

type BuildWiringProofResultOptionsHttpSecurityRateLimitShape = {
    windowMs: number
    defaultLimit: number
    strictLimit: number
}

type BuildWiringProofResultOptionsHttpSecurityShape = {
    trustedProxyHops: number
    allowedOrigins: Array<string>
    rateLimit: BuildWiringProofResultOptionsHttpSecurityRateLimitShape
    webhooks: BuildWiringProofResultOptionsHttpSecurityWebhooksShape
}

type BuildWiringProofResultOptionsServerShape = {
    port: number
}

type BuildWiringProofResultOptionsEntityEngineShape = {
    cursorKey: Secret
    buildId: undefined
}

type BuildWiringProofResultOptionsSepayShape = {
    apiBase: string
    timeoutMs: number
}

type BuildWiringProofResultOptionsShape = {
    server: BuildWiringProofResultOptionsServerShape
    httpSecurity: BuildWiringProofResultOptionsHttpSecurityShape
    database: BuildWiringProofResultOptionsDatabaseShape
    queue: BuildWiringProofResultOptionsQueueShape
    connectionSecrets: BuildWiringProofResultOptionsConnectionSecretsShape
    toolsConfig: BuildWiringProofResultOptionsToolsConfigShape
    ai: BuildWiringProofResultOptionsAiShape
    qdrant: BuildWiringProofResultOptionsQdrantShape
    sepay: BuildWiringProofResultOptionsSepayShape
    entityEngine: BuildWiringProofResultOptionsEntityEngineShape
}

type BuildWiringProofResultShape = {
    options: BuildWiringProofResultOptionsShape
    overrides: Array<BuildWiringProofResultOverridesShape>
}

/** Compiles the real mcp root with explicit options and existing infrastructure-token doubles. */
export const buildWiringProof = (_AppModule: unknown): BuildWiringProofResultShape => ({
    options,
    overrides: resourceOverrides(),
})
