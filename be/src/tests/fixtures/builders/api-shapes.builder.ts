import type { InjectionToken } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"

/** The build wiring proof result overrides record the builders hand out and the specs expect. */
export type BuildWiringProofResultOverridesShape = { token: InjectionToken; value: unknown }
/** The build wiring proof result options connection poll schedule record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsConnectionPollScheduleShape = {
    healthyIntervalMs: number
    silentIntervalMs: number
    hotIntervalMs: number
    webhookSilentAfterMs: number
    hotTtlMs: number
    jitterRatio: number
    backoffBaseMs: number
    backoffCapMs: number
    breakerThreshold: number
    breakerCooldownMs: number
    breakerCooldownCapMs: number
    unavailableRecheckMs: number
    batchSize: number
    leaseMs: number
    maxInlineWaitMs: number
    backfillChunkPages: number
}
/** The build wiring proof result options connection poll record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsConnectionPollShape = {
    schedule: BuildWiringProofResultOptionsConnectionPollScheduleShape
    redis: undefined
}
/** The build wiring proof result options redis record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsRedisShape = { connectTimeoutMs: number }
/** The build wiring proof result options remote files record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsRemoteFilesShape = {
    maxBytes: number
    timeoutMs: number
    maxRedirects: number
}
/** The build wiring proof result options entity engine record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsEntityEngineShape = { cursorKey: Secret; buildId: undefined }
/** The build wiring proof result options agent work record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAgentWorkShape = { debounceMs: number }
/** The build wiring proof result options zalo provider record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsZaloProviderShape = { replyWindowMs: number; staleAfterMs: number }
/** The build wiring proof result options knowledge record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsKnowledgeShape = { indexChunkDelayMs: number }
/** The build wiring proof result options mcp gateway remote record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsMcpGatewayRemoteShape = { clientName: string }
/** The build wiring proof result options mcp gateway record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsMcpGatewayShape = {
    remote: BuildWiringProofResultOptionsMcpGatewayRemoteShape
    defaultTimeoutMs: number
}
/** The build wiring proof result options video record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsVideoShape = {
    fontsDir: string
    workDir: string
    maxSeconds: number
    ffmpegThreads: number
}
/** The build wiring proof result options tts record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsTtsShape = {
    provider: "none"
    cacheDir: string
    workDir: string
    minGapMs: number
}
/** The build wiring proof result options ffmpeg record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsFfmpegShape = { nice: boolean }
/** The build wiring proof result options webhook delivery record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsWebhookDeliveryShape = { timeoutMs: number }
/** The build wiring proof result options channel setup record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsChannelSetupShape = {
    zaloOauthBase: undefined
    siteUrl: string
    timeoutMs: number
}
/** The build wiring proof result options meta record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsMetaShape = {
    app: null
    webhookVerifyToken: undefined
    loginConfigId: undefined
    graphVersion: string
    siteUrl: string
    channelTokenKey: Secret
    sendPerMinute: number
    timeoutMs: number
}
/** The build wiring proof result options google record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsGoogleShape = {
    client: null
    oauthBase: undefined
    sheetsBase: undefined
    siteUrl: string
    channelTokenKey: Secret
    timeoutMs: number
}
/** The build wiring proof result options webhook connections record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsWebhookConnectionsShape = { signingSecret: undefined }
/** The build wiring proof result options connections record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsConnectionsShape = {
    channelTokenKey: Secret
    siteUrl: string
    publicSiteUrl: undefined
    publicApiUrl: string
}
/** The build wiring proof result options jobs alert record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsJobsAlertShape = {
    enabled: boolean
    intervalMs: number
    failedMax: number
    staleSeconds: number
}
/** The build wiring proof result options jobs scheduler record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsJobsSchedulerShape = { enabled: boolean }
/** The build wiring proof result options jobs record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsJobsShape = {
    workerId: string
    leaseMs: number
    scheduler: BuildWiringProofResultOptionsJobsSchedulerShape
}
/** The build wiring proof result options queue record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsQueueShape = {
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
/** The build wiring proof result options realtime record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsRealtimeShape = { hub: "memory" }
/** The build wiring proof result options platform admin record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsPlatformAdminShape = { admins: Array<never> }
/** The build wiring proof result options telegram user record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsTelegramUserShape = { app: null }
/** The build wiring proof result options data sources record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsDataSourcesShape = { allowPrivateHosts: boolean }
/** The sender of the mail record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsMailFromShape = { name: string; address: string }
/** The build wiring proof result options mail record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsMailShape = {
    host: string
    port: number
    security: "none"
    from: BuildWiringProofResultOptionsMailFromShape
    helloName: string
    webOrigin: string
    brandName: string
    defaultLanguage: "en"
    confirmTtlSeconds: number
    resetTtlSeconds: number
    allowPrivateHosts: boolean
    suppress: Array<string>
    outboxDir: null
}
/** The build wiring proof result options zalo record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsZaloShape = {
    oauthBase: string
    apiBase: string
    businessBase: string
    timeoutMs: number
}
/** The build wiring proof result options telegram record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsTelegramShape = { apiBase: string; timeoutMs: number }
/** The build wiring proof result options channels record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsChannelsShape = { siteUrl: string }
/** The build wiring proof result options connection secrets record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsConnectionSecretsShape = { tokenKey: Secret }
/** The build wiring proof result options ai tasks endpoint record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAiTasksEndpointShape = {
    gatewayUrl: null
    virtualKey: null
    chatModel: string
    embeddingModel: string
}
/** The build wiring proof result options ai tasks record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAiTasksShape = {
    jsonRetries: number
    timeoutMs: number
    endpoint: BuildWiringProofResultOptionsAiTasksEndpointShape
}
/** The build wiring proof result options agent turns record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAgentTurnsShape = { bridgeSecret: null }
/** The build wiring proof result options openclaw record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsOpenclawShape = {
    gateway: null
    turnTimeoutMs: number
    settleMs: number
    configDir: undefined
    gatewayStateDir: string
    manageAgents: boolean
    toolSecret: null
}
/** The build wiring proof result options billing bank account record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsBillingBankAccountShape = { account: string; bank: string; holder: string }
/** The build wiring proof result options billing record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsBillingShape = {
    sepayApiKey: undefined
    bankAccount: BuildWiringProofResultOptionsBillingBankAccountShape
}
/** The build wiring proof result options workspace invites record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsWorkspaceInvitesShape = { siteUrl: string; inviteDays: number }
/** The build wiring proof result options workspaces record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsWorkspacesShape = { allowFreeWorkspace: boolean }
/** The build wiring proof result options documents readers record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsDocumentsReadersShape = {
    docx: () => never
    pdf: () => never
    pdfPages: () => never
}
/** The build wiring proof result options documents record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsDocumentsShape = {
    driveBase: string
    oauthBase: null
    google: null
    readers: BuildWiringProofResultOptionsDocumentsReadersShape
}
/** The build wiring proof result options identity auth record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsIdentityAuthShape = {
    inviteTtlSeconds: number
}
/** The signing key of the passport record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsPassportKeyShape = { privateKey: Secret; publicKey: string; keyId: undefined }
/** The refresh cookie of the passport record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsPassportCookieShape = { name: string; domain: undefined }
/** The sign-in budget of the passport record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsPassportBudgetShape = {
    loginAttempts: number
    resetAttempts: number
    windowMs: number
}
/** The build wiring proof result options passport record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsPassportShape = {
    issuer: string
    audience: string
    keys: Array<BuildWiringProofResultOptionsPassportKeyShape>
    accessTtlSeconds: number
    refreshTtlSeconds: number
    bcryptCost: number
    returnOrigin: string
    google: null
    cookie: BuildWiringProofResultOptionsPassportCookieShape
    budget: BuildWiringProofResultOptionsPassportBudgetShape
}
/** The build wiring proof result options ai gateway models record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAiGatewayModelsShape = { work: string; embed: string }
/** The build wiring proof result options ai gateway record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsAiGatewayShape = {
    providers: Array<never>
    models: BuildWiringProofResultOptionsAiGatewayModelsShape
    gateway: null
}
/** The build wiring proof result options storage record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsStorageShape = {
    endpoint: string
    region: string
    accessKey: Secret
    secretKey: Secret
    bucketPrefix: string
    publicUrl: string
    timeoutMs: number
}
/** The build wiring proof result options database record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsDatabaseShape = {
    name: string
    provider: "postgres"
    url: Secret
    schema: string
}
/** The build wiring proof result options http security webhooks record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsHttpSecurityWebhooksShape = {}
/** The build wiring proof result options http security rate limit record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsHttpSecurityRateLimitShape = {
    windowMs: number
    defaultLimit: number
    strictLimit: number
}
/** The build wiring proof result options http security record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsHttpSecurityShape = {
    trustedProxyHops: number
    allowedOrigins: Array<string>
    rateLimit: BuildWiringProofResultOptionsHttpSecurityRateLimitShape
    webhooks: BuildWiringProofResultOptionsHttpSecurityWebhooksShape
}
/** The build wiring proof result options server record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsServerShape = { port: number }
/** The build wiring proof result options record the builders hand out and the specs expect. */
export type BuildWiringProofResultOptionsShape = {
    server: BuildWiringProofResultOptionsServerShape
    httpSecurity: BuildWiringProofResultOptionsHttpSecurityShape
    database: BuildWiringProofResultOptionsDatabaseShape
    storage: BuildWiringProofResultOptionsStorageShape
    aiGateway: BuildWiringProofResultOptionsAiGatewayShape
    passport: BuildWiringProofResultOptionsPassportShape
    identityAuth: BuildWiringProofResultOptionsIdentityAuthShape
    documents: BuildWiringProofResultOptionsDocumentsShape
    workspaces: BuildWiringProofResultOptionsWorkspacesShape
    workspaceInvites: BuildWiringProofResultOptionsWorkspaceInvitesShape
    billing: BuildWiringProofResultOptionsBillingShape
    connectionPoll: BuildWiringProofResultOptionsConnectionPollShape
    redis: BuildWiringProofResultOptionsRedisShape
    remoteFiles: BuildWiringProofResultOptionsRemoteFilesShape
    entityEngine: BuildWiringProofResultOptionsEntityEngineShape
    openclaw: BuildWiringProofResultOptionsOpenclawShape
    agentTurns: BuildWiringProofResultOptionsAgentTurnsShape
    aiTasks: BuildWiringProofResultOptionsAiTasksShape
    connectionSecrets: BuildWiringProofResultOptionsConnectionSecretsShape
    channels: BuildWiringProofResultOptionsChannelsShape
    telegram: BuildWiringProofResultOptionsTelegramShape
    sepay: BuildWiringProofResultOptionsTelegramShape
    zalo: BuildWiringProofResultOptionsZaloShape
    zaloProvider: BuildWiringProofResultOptionsZaloProviderShape
    mail: BuildWiringProofResultOptionsMailShape
    dataSources: BuildWiringProofResultOptionsDataSourcesShape
    telegramUser: BuildWiringProofResultOptionsTelegramUserShape
    platformAdmin: BuildWiringProofResultOptionsPlatformAdminShape
    realtime: BuildWiringProofResultOptionsRealtimeShape
    queue: BuildWiringProofResultOptionsQueueShape
    agentWork: BuildWiringProofResultOptionsAgentWorkShape
    jobs: BuildWiringProofResultOptionsJobsShape
    jobsAlert: BuildWiringProofResultOptionsJobsAlertShape
    connections: BuildWiringProofResultOptionsConnectionsShape
    webhookConnections: BuildWiringProofResultOptionsWebhookConnectionsShape
    google: BuildWiringProofResultOptionsGoogleShape
    meta: BuildWiringProofResultOptionsMetaShape
    channelSetup: BuildWiringProofResultOptionsChannelSetupShape
    webhookDelivery: BuildWiringProofResultOptionsWebhookDeliveryShape
    ffmpeg: BuildWiringProofResultOptionsFfmpegShape
    tts: BuildWiringProofResultOptionsTtsShape
    video: BuildWiringProofResultOptionsVideoShape
    mcpGateway: BuildWiringProofResultOptionsMcpGatewayShape
    knowledge: BuildWiringProofResultOptionsKnowledgeShape
}
/** The build wiring proof result record the builders hand out and the specs expect. */
export type BuildWiringProofResultShape = {
    options: BuildWiringProofResultOptionsShape
    overrides: Array<BuildWiringProofResultOverridesShape>
}
