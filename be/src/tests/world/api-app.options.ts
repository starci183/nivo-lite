import { EnvSource, Secret } from "@modules/platform/config"
import { parseConnectionPollConfig } from "@modules/domain/connection-poll"
import { parseRedisConfig } from "@modules/integrations/redis"
import { parseRemoteFilesConfig } from "@modules/integrations/remote-files"
import { parseInetConfig } from "@modules/integrations/inet"
import { parsePayosConfig } from "@modules/integrations/payos"
import { parseTinoConfig } from "@modules/integrations/tino"
import { parseElevenLabsConfig } from "@modules/integrations/elevenlabs"
import { parseVeoConfig } from "@modules/integrations/veo"
import { parseShotstackConfig } from "@modules/integrations/shotstack"
import { parseCreatomateConfig } from "@modules/integrations/creatomate"
import { parseJson2VideoConfig } from "@modules/integrations/json2video"
import { parseGoogleCalendarConfig } from "@modules/integrations/google-calendar"
import { parseMetaPublishingConfig } from "@modules/integrations/meta-publishing"
import { parseYoutubeConfig } from "@modules/integrations/youtube"
import { parseTiktokConfig } from "@modules/integrations/tiktok"
import { parseMisaAmisConfig } from "@modules/integrations/misa-amis"
import { parseMisaMeinvoiceConfig } from "@modules/integrations/misa-meinvoice"
import { parseZaloProviderConfig } from "@modules/domain/zalo-provider"
import type { DynamicModule } from "@nestjs/common"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { HttpError, HttpErrorCode } from "@modules/platform/http"
import { AppModule } from "../../../apps/api/src/app.module"
import type { ApiOptions } from "../../../apps/api/src/api.options"

/** Refuses every operation that would leave the machine: the proofs of the api never reach a provider. */
const refuseNetwork = (): never => {
    throw new HttpError({ code: HttpErrorCode.Network })
}

/** The token key of the channel credentials of the proofs; synthetic. */
const TOKEN_KEY = new Secret("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

/** The site of the proofs; nothing listens there. */
const SITE = "https://site.invalid"

/** The providers of the api, every one at an address nothing answers. */
const providerOptions = () => ({
    agentTurns: { bridgeSecret: null },
    aiTasks: {
        jsonRetries: 1,
        timeoutMs: 1000,
        endpoint: { gatewayUrl: null, virtualKey: null, chatModel: "work", embeddingModel: "embed" },
    },
    connectionSecrets: { tokenKey: TOKEN_KEY },
    channels: { siteUrl: SITE },
    telegram: { apiBase: "https://telegram.invalid", timeoutMs: 1000 },
    zalo: {
        oauthBase: "https://zalo.invalid",
        apiBase: "https://zalo.invalid",
        businessBase: "https://zalo.invalid",
        timeoutMs: 1000,
    },
    dataSources: { allowPrivateHosts: false },
    telegramUser: { app: null },
    platformAdmin: { admins: [] },
    inet: parseInetConfig(new EnvSource({})),
    tino: parseTinoConfig(new EnvSource({})),
    payos: parsePayosConfig(new EnvSource({})),
    elevenlabs: parseElevenLabsConfig(new EnvSource({})),
    veo: parseVeoConfig(new EnvSource({})),
    shotstack: parseShotstackConfig(new EnvSource({})),
    creatomate: parseCreatomateConfig(new EnvSource({})),
    json2video: parseJson2VideoConfig(new EnvSource({})),
    googleCalendar: parseGoogleCalendarConfig(new EnvSource({})),
    metaPublishing: parseMetaPublishingConfig(new EnvSource({})),
    youtube: parseYoutubeConfig(new EnvSource({})),
    tiktok: parseTiktokConfig(new EnvSource({})),
    misaAmis: parseMisaAmisConfig(new EnvSource({})),
    misaMeinvoice: parseMisaMeinvoiceConfig(new EnvSource({})),
})

/** Sign-in settings for a proof: keys that are never loaded and no Google client. */
const localPassport: ApiOptions["passport"] = {
    issuer: "world-proof",
    audience: "authenticated",
    keys: [{ privateKey: new Secret("world-proof"), publicKey: "world-proof", keyId: undefined }],
    accessTtlSeconds: 900,
    refreshTtlSeconds: 60,
    bcryptCost: 4,
    returnOrigin: SITE,
    google: null,
    cookie: { name: "nivo_refresh", domain: undefined },
    budget: { loginAttempts: 5, resetAttempts: 5, windowMs: 60000 },
}

const localIdentityAuth: ApiOptions["identityAuth"] = { inviteTtlSeconds: 60 }

/** Mail for a proof: a sink address nothing listens on, and the settings of the app's own mail. */
const localMail: ApiOptions["mail"] = {
    host: "127.0.0.1",
    port: 2525,
    security: "none",
    from: { name: "World", address: "no-reply@world.invalid" },
    helloName: "world.invalid",
    webOrigin: SITE,
    brandName: "World",
    defaultLanguage: "en",
    confirmTtlSeconds: 60,
    resetTtlSeconds: 60,
    allowPrivateHosts: false,
    suppress: ["*.invalid"],
    outboxDir: null,
}

/** An AI pool with no keys: no router and no gateway are registered, so the api boots and its AI callers fall back without a provider call. */
const keylessAiGateway: ApiOptions["aiGateway"] = {
    providers: [],
    models: { work: "world-chat", strong: "world-strong" },
    gateway: null,
}

/** The object store of the proof: an address nothing answers. */
const storageProof = {
    endpoint: "https://storage.invalid:9000",
    region: "us-east-1",
    accessKey: new Secret("world-proof"),
    secretKey: new Secret("world-proof"),
    bucketPrefix: "world",
    publicUrl: "https://storage.invalid:9000",
    timeoutMs: 1000,
}

/** The poll settings of the api, at their defaults with no provider behind them. */
const pollOptions = (): Pick<
    ApiOptions,
    "connectionPoll" | "redis" | "remoteFiles" | "sepay" | "zaloProvider"
> => ({
    connectionPoll: parseConnectionPollConfig(new EnvSource({})),
    redis: parseRedisConfig(new EnvSource({})),
    remoteFiles: parseRemoteFilesConfig(new EnvSource({})),
    sepay: { apiBase: "https://sepay.invalid", timeoutMs: 1000 },
    zaloProvider: parseZaloProviderConfig(new EnvSource({})),
})

/** The http hardening of the proof api: one trusted origin, the default rate limits and no webhook secrets. */
const localHttpSecurity = (): ApiOptions["httpSecurity"] => ({
    trustedProxyHops: 0,
    allowedOrigins: [SITE],
    rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
    webhooks: {},
})

/**
 * The api as it runs, over the local PostgreSQL database the world points at (the global setup names it), with every provider set to
 * an address nothing answers: a proof of the api goes through its real composition and never reaches a provider.
 */
const localApiOptions = (): ApiOptions => ({
    server: { port: 0 },
    httpSecurity: localHttpSecurity(),
    database: parsePrimaryDatabaseConfig(EnvSource.fromProcess()),
    storage: storageProof,
    aiGateway: keylessAiGateway,
    passport: localPassport,
    identityAuth: localIdentityAuth,
    mail: localMail,
    documents: {
        driveBase: "https://drive.invalid",
        oauthBase: null,
        google: null,
        readers: { docx: refuseNetwork, pdf: refuseNetwork, pdfPages: refuseNetwork },
    },
    workspaces: { allowFreeWorkspace: true },
    apiKeys: {},
    workspaceInvites: { siteUrl: SITE, inviteDays: 7 },
    billing: {
        sepayApiKey: undefined,
        bankAccount: { account: "proof", bank: "proof", holder: "Proof" },
    },
    ...pollOptions(),
    ...providerOptions(),
    entityEngine: { cursorKey: TOKEN_KEY },
    realtime: { hub: "memory" as const },
    queue: {
        enabled: false,
        redisHost: "redis.invalid",
        redisPort: 6379,
        redisDb: 0,
        prefix: "world-proof",
        concurrency: 1,
        workspaceConcurrency: 1,
        relayIntervalMs: 500,
        relayBatch: 50,
        reconcileAfterMs: 15000,
        visibilityTimeoutMs: 60000,
        shutdownGraceMs: 1000,
    },
    jobs: { workerId: "world-proof", leaseMs: 60000, scheduler: { enabled: false } },
    jobsAlert: { enabled: false, intervalMs: 60000, failedMax: 1, staleSeconds: 60 },
    connections: {
        channelTokenKey: TOKEN_KEY,
        siteUrl: SITE,
        publicSiteUrl: undefined,
        publicApiUrl: "https://api.invalid",
    },
    webhookConnections: { signingSecret: undefined },
    google: {
        client: null,
        oauthBase: undefined,
        sheetsBase: undefined,
        siteUrl: SITE,
        channelTokenKey: TOKEN_KEY,
        timeoutMs: 1000,
    },
    meta: {
        app: null,
        webhookVerifyToken: undefined,
        loginConfigId: undefined,
        graphVersion: "v21.0",
        siteUrl: SITE,
        channelTokenKey: TOKEN_KEY,
        sendPerMinute: 10,
        timeoutMs: 1000,
    },
    channelSetup: { zaloOauthBase: undefined, siteUrl: SITE, timeoutMs: 1000 },
    webhookDelivery: { timeoutMs: 1000 },
    toolsConfig: { defaultTimeoutMs: 4000 },
    knowledge: { indexChunkDelayMs: 0 },
    // No vector index in a proof: vectors stay in Postgres (the one switch is QDRANT_URL).
    qdrant: { url: null, apiKey: null, timeoutMs: 5000 },
})

/** The optional external model configuration of a proof; every domain binding remains the production binding. */
export interface ApiProofOptions {
    readonly aiTasks?: ApiOptions["aiTasks"]
}

/** The real API graph with an optional network-edge model endpoint and the same keyless default. */
export const apiAppModules = (options: ApiProofOptions = {}): Array<DynamicModule> => [
    AppModule.register({
        ...localApiOptions(),
        ...(options.aiTasks === undefined ? {} : { aiTasks: options.aiTasks }),
    }),
]

/** The api's own composition as one module of the world. */
export const API_APP_MODULES: Array<DynamicModule> = apiAppModules()
