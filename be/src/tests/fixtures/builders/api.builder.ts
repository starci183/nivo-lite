import { fakeIds } from "@starci/jest-preset"
import type { InjectionToken } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QueueModule } from "@modules/platform/queue"
import { ObjectStorageModule } from "@modules/integrations/object-storage"
import { IdentityModule } from "@modules/domain/identity"

const PRIMARY_DATA_SOURCE = "primaryDataSource"
const wiringIds = fakeIds()

/** Refuses infrastructure operations during construction of the module graph. */
const refuseWiringOperation = (): never => {
    throw new HttpError({ code: HttpErrorCode.Network })
}

/** Synthetic connection settings; no environment source is read. */
const wiringSettings = {
    database: {
        name: "primary",
        provider: "supabase" as const,
        url: new Secret(`postgresql://wiring:${wiringIds.next()}@database.invalid:5432/wiring`),
        schema: "public",
    },
    storage: {
        endpoint: "https://storage.invalid:9000",
        region: "us-east-1",
        accessKey: new Secret("wiring-fixture"),
        secretKey: new Secret("wiring-fixture"),
        bucketPrefix: "wiring",
        publicUrl: "https://storage.invalid:9000",
        timeoutMs: 1000,
    },
    channelConnections: {
        channelTokenKey: new Secret("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="),
        siteUrl: "https://site.invalid",
        publicSiteUrl: undefined,
        publicApiUrl: "https://api.invalid",
    },
    channelSetup: { zaloOauthBase: undefined, siteUrl: "https://site.invalid", timeoutMs: 1000 },
}

const options = {
    server: { port: 3000 },
    httpSecurity: {
        trustedProxyHops: 0,
        allowedOrigins: ["https://site.invalid"],
        rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
        webhooks: {},
    },
    database: wiringSettings.database,
    storage: wiringSettings.storage,
    aiGateway: { providers: [], models: { work: "wiring-chat", embed: "wiring-embedding" }, gateway: null },
    passport: {
        privateKey: new Secret("wiring-fixture"),
        publicKey: "wiring-fixture",
        keyId: undefined,
        issuer: "wiring",
        returnOrigin: "https://site.invalid",
        audience: "authenticated",
        accessTtlSeconds: 900,
        bcryptCost: 4,
        google: null,
    },
    identityAuth: {
        webOrigin: "https://site.invalid",
        cookieDomain: undefined,
        refreshTtlSeconds: 60,
        resetTtlSeconds: 60,
        inviteTtlSeconds: 60,
        loginAttempts: 5,
        resetAttempts: 5,
        attemptWindowMs: 60000,
    },
    documents: {
        driveBase: "https://drive.invalid",
        oauthBase: null,
        google: null,
        readers: { docx: refuseWiringOperation, pdf: refuseWiringOperation },
    },
    workspaces: { allowFreeWorkspace: true },
    workspaceInvites: { siteUrl: "https://site.invalid", inviteDays: 7 },
    billing: {
        sepayApiKey: undefined,
        bankAccount: { account: "fixture", bank: "fixture", holder: "Wiring Fixture" },
    },
    openclaw: {
        gateway: null,
        turnTimeoutMs: 1000,
        settleMs: 100,
        configDir: undefined,
        gatewayStateDir: "wiring-fixture",
        manageAgents: false,
        toolSecret: null,
    },
    agentTurns: { bridgeSecret: null },
    aiTasks: {
        jsonRetries: 1,
        timeoutMs: 1000,
        endpoint: { gatewayUrl: null, virtualKey: null, chatModel: "work", embeddingModel: "embed" },
    },
    connectionSecrets: { tokenKey: wiringSettings.channelConnections.channelTokenKey },
    loyaltyOtps: { pepper: new Secret("wiring-fixture") },
    channels: { siteUrl: "https://site.invalid" },
    telegram: { apiBase: "https://telegram.invalid", timeoutMs: 1000 },
    zalo: {
        oauthBase: "https://zalo.invalid",
        apiBase: "https://zalo.invalid",
        businessBase: "https://zalo.invalid",
        timeoutMs: 1000,
    },
    mail: { allowPrivateHosts: false, platform: null, helloName: "wiring.invalid" },
    dataSources: { allowPrivateHosts: false },
    telegramUser: { app: null },
    platformAdmin: { admins: [] },
    realtime: { hub: "memory" as const },
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
    jobs: { workerId: "wiring-fixture", leaseMs: 60000, scheduler: { enabled: false } },
    jobsAlert: { enabled: false, intervalMs: 60000, failedMax: 1, staleSeconds: 60 },
    connections: wiringSettings.channelConnections,
    webhookConnections: { signingSecret: undefined },
    google: {
        client: null,
        oauthBase: undefined,
        sheetsBase: undefined,
        siteUrl: "https://site.invalid",
        channelTokenKey: wiringSettings.channelConnections.channelTokenKey,
        timeoutMs: 1000,
    },
    meta: {
        app: null,
        webhookVerifyToken: undefined,
        loginConfigId: undefined,
        graphVersion: "v21.0",
        siteUrl: "https://site.invalid",
        channelTokenKey: wiringSettings.channelConnections.channelTokenKey,
        sendPerMinute: 10,
        timeoutMs: 1000,
    },
    channelSetup: wiringSettings.channelSetup,
    webhookDelivery: { timeoutMs: 1000 },
    n8n: {
        signingSecret: new Secret("wiring-fixture"),
        webhookBase: undefined,
        allowedHosts: [],
        timeoutMs: 1000,
    },
    ffmpeg: { nice: false },
    tts: { provider: "none" as const, cacheDir: "wiring-fixture/cache", workDir: "wiring-fixture/work", minGapMs: 0 },
    video: {
        fontsDir: "wiring-fixture/fonts",
        workDir: "wiring-fixture/work",
        maxSeconds: 60,
        ffmpegThreads: 1,
    },
    mcpGateway: { remote: { clientName: "nivo-mcp-gateway" }, defaultTimeoutMs: 4000 },
    knowledge: { indexChunkDelayMs: 0 },
}

/** Explicit doubles for the private resource tokens of the real registered modules. */
const resourceDoubles = (): ReadonlyMap<string, unknown> => {
    const manager = { query: refuseWiringOperation, transaction: refuseWiringOperation }
    const transport = {
        add: refuseWiringOperation,
        stateOf: refuseWiringOperation,
        republish: refuseWiringOperation,
        work: refuseWiringOperation,
        wait: refuseWiringOperation,
        close: refuseWiringOperation,
    }
    return new Map<string, unknown>([
        [
            "primaryDataSource",
            {
                manager,
                isInitialized: true,
                subscribers: [],
                query: refuseWiringOperation,
                createQueryRunner: refuseWiringOperation,
            },
        ],
        ["platform.database.primary-entity-manager", manager],
        ["platform.http.client", { request: refuseWiringOperation }],
        ["domain.identity.access-token-verifier", refuseWiringOperation],
        [
            "integrations.object-storage.client",
            {
                put: refuseWiringOperation,
                get: refuseWiringOperation,
                head: refuseWiringOperation,
                remove: refuseWiringOperation,
                list: refuseWiringOperation,
                walk: refuseWiringOperation,
                presignGet: refuseWiringOperation,
                presignPut: refuseWiringOperation,
                ensureBucket: refuseWiringOperation,
            },
        ],
        ["platform.queue.transport", transport],
        ["BullmqQueueTransportClient", transport],
    ])
}

/** Reads the existing private tokens through public resource registrations; no database is registered twice. */
const resourceOverrides = (): Array<{ token: InjectionToken; value: unknown }> => {
    const resources = resourceDoubles()
    const overrides: Array<{ token: InjectionToken; value: unknown }> = [
        { token: PRIMARY_DATA_SOURCE, value: resources.get(PRIMARY_DATA_SOURCE) },
        { token: PRIMARY_ENTITY_MANAGER, value: resources.get("platform.database.primary-entity-manager") },
        { token: HTTP_CLIENT, value: resources.get("platform.http.client") },
    ]
    const definitions = [
        IdentityModule.register({ verifyAccessToken: refuseWiringOperation }),
        ObjectStorageModule.register(wiringSettings.storage),
        QueueModule.register({ ...options.queue, schedulers: [] }),
    ]
    const privateOverrides = definitions.flatMap((definition) =>
        (definition.providers ?? []).flatMap((provider) => {
            const token = typeof provider === "function" ? provider : provider.provide
            let name: string | undefined
            if (typeof token === "symbol") name = token.description
            if (typeof token === "function") name = token.name
            if (name === undefined || !resources.has(name)) return []
            return [{ token, value: resources.get(name) }]
        }),
    )
    return [...overrides, ...privateOverrides]
}

/** Compiles the real API root with explicit options and existing infrastructure-token doubles. */
export const buildWiringProof = (_AppModule: unknown) => ({ options, overrides: resourceOverrides() })
