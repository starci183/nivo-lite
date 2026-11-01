import { fakeIds } from "@starci/jest-preset"
import type { InjectionToken } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QueueModule } from "@modules/platform/queue"
import { ObjectStorageModule } from "@modules/integrations/object-storage"

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
        provider: "postgres" as const,
        url: new Secret(`postgresql://wiring:${wiringIds.next()}@database.invalid:5432/wiring`),
        schema: "public",
    },
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
    mail: { allowPrivateHosts: true, platform: null, helloName: "wiring.invalid" },
    ai: { gatewayUrl: null, virtualKey: null, chatModel: "work", embeddingModel: "embed" },
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
    },
    channelSetup: { zaloOauthBase: undefined, siteUrl: "https://site.invalid", timeoutMs: 1000 },
}

const options = {
    connections: [wiringSettings.database],
    passport: wiringSettings.passport,
    identityAuth: wiringSettings.identityAuth,
    mail: wiringSettings.mail,
    storage: wiringSettings.storage,
    ai: wiringSettings.ai,
    channelConnections: wiringSettings.channelConnections,
    channelSetup: wiringSettings.channelSetup,
    n8nHost: { host: undefined, user: "wiring", sshKey: undefined, knownHosts: undefined, container: "wiring" },
    channelProvisioning: { telegramToken: undefined, print: refuseWiringOperation },
    workspaceSeed: { input: undefined, profileInput: undefined },
    mcpGateway: { remote: { clientName: "nivo-mcp-gateway" }, defaultTimeoutMs: 1000 },
    openclaw: {
        gateway: null,
        turnTimeoutMs: 90_000,
        settleMs: 3000,
        configDir: undefined,
        gatewayStateDir: "/wiring",
        manageAgents: false,
        toolSecret: null,
    },
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

/** Resolves the diagnostic name of a registered private resource token. */
const resourceName = (token: InjectionToken): string | undefined => {
    if (typeof token === "symbol") return token.description
    if (typeof token === "function") return token.name
    return undefined
}

/** Reads private object-storage and producer-only queue tokens through their public registrations. */
const resourceOverrides = (): Array<{ token: InjectionToken; value: unknown }> => {
    const resources = resourceDoubles()
    const overrides: Array<{ token: InjectionToken; value: unknown }> = []
    const definitions = [
        ObjectStorageModule.register(wiringSettings.storage),
        QueueModule.register({
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
            schedulers: [],
        }),
    ]
    for (const definition of definitions) {
        for (const provider of definition.providers ?? []) {
            const token = typeof provider === "function" ? provider : provider.provide
            const name = resourceName(token)
            if (name !== undefined && resources.has(name)) overrides.push({ token, value: resources.get(name) })
        }
    }
    return overrides
}

/** Compiles the real CLI root with explicit options and existing infrastructure-token doubles. */
export const buildWiringProof = (_AppModule: unknown) => {
    const resources = resourceDoubles()
    return {
        options,
        overrides: [
            { token: PRIMARY_DATA_SOURCE, value: resources.get(PRIMARY_DATA_SOURCE) },
            { token: PRIMARY_ENTITY_MANAGER, value: resources.get("platform.database.primary-entity-manager") },
            { token: HTTP_CLIENT, value: resources.get("platform.http.client") },
            ...resourceOverrides(),
        ],
    }
}
