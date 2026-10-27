import { EnvSource, Secret } from "@modules/platform/config"
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
    openclaw: {
        gateway: null,
        turnTimeoutMs: 1000,
        settleMs: 100,
        configDir: undefined,
        gatewayStateDir: "world-proof",
        manageAgents: false,
        toolSecret: null,
    },
    deepseek: { jsonRetries: 1, poolTimeoutMs: 1000 },
    connectionSecrets: { tokenKey: TOKEN_KEY },
    loyaltyOtps: { pepper: new Secret("world-proof") },
    channels: { siteUrl: SITE },
    telegram: { apiBase: "https://telegram.invalid", timeoutMs: 1000 },
    zalo: {
        oauthBase: "https://zalo.invalid",
        apiBase: "https://zalo.invalid",
        businessBase: "https://zalo.invalid",
        timeoutMs: 1000,
    },
    mail: { allowPrivateHosts: false, platform: null, helloName: "world.invalid" },
    dataSources: { allowPrivateHosts: false },
    telegramUser: { app: null },
    platformAdmin: { admins: [] },
})

/** An AI pool with no keys: every provider sits out, so the api boots and its AI callers fall back without a provider call. */
const keylessAiPool: ApiOptions["aiPool"] = {
    chat: [
        { id: "deepseek", baseUrl: "https://llm.invalid", keys: [], model: "world-chat", smartModel: null },
        { id: "openrouter", baseUrl: "https://llm.invalid", keys: [], model: "world-chat", smartModel: null },
    ],
    embedding: {
        id: "embeddings",
        baseUrl: "https://llm.invalid",
        keys: [],
        model: "world-embedding",
        smartModel: null,
    },
}

/**
 * The api as it runs, over the local Supabase database the world points at (the global setup names it), with every provider set to
 * an address nothing answers: a proof of the api goes through its real composition and never reaches a provider.
 */
const localApiOptions = (): ApiOptions => ({
    server: { port: 0 },
    httpSecurity: {
        trustedProxyHops: 0,
        allowedOrigins: [SITE],
        rateLimit: { windowMs: 60000, defaultLimit: 100, strictLimit: 10 },
        webhooks: {},
    },
    database: parsePrimaryDatabaseConfig(EnvSource.fromProcess()),
    supabase: { url: "https://supabase.invalid", serviceRoleKey: new Secret("world-proof") },
    aiPool: keylessAiPool,
    documents: {
        driveBase: "https://drive.invalid",
        oauthBase: null,
        google: null,
        readers: { docx: refuseNetwork, pdf: refuseNetwork },
    },
    workspaces: { allowFreeWorkspace: true },
    workspaceInvites: { siteUrl: SITE, inviteDays: 7 },
    billing: {
        sepayApiKey: undefined,
        bankAccount: { account: "proof", bank: "proof", holder: "Proof" },
        channelTokenKey: TOKEN_KEY,
    },
    ...providerOptions(),
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
    jobs: { workerId: "world-proof", leaseMs: 60000 },
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
    n8n: { signingSecret: new Secret("world-proof"), webhookBase: undefined, allowedHosts: [], timeoutMs: 1000 },
    ffmpeg: { nice: false },
    tts: { provider: "none", cacheDir: "world-proof/cache", workDir: "world-proof/work", minGapMs: 0 },
    video: { fontsDir: "world-proof/fonts", workDir: "world-proof/work", maxSeconds: 60, ffmpegThreads: 1 },
    mcpGateway: { remote: { clientName: "nivo-mcp-gateway" }, defaultTimeoutMs: 4000 },
})

/** The api's own composition as one module of the world. */
export const API_APP_MODULES = [AppModule.register(localApiOptions())]
