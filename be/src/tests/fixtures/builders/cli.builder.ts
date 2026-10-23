import { fakeIds } from "@starci/jest-preset"
import type { InjectionToken } from "@nestjs/common"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QueueModule } from "@modules/platform/queue"
import { SupabaseModule } from "@modules/integrations/supabase"

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
    supabase: { url: "https://supabase.invalid", serviceRoleKey: new Secret("wiring-fixture") },
    llm: {
        embedding: { apiKey: null, baseUrl: "https://llm.invalid", model: "wiring-embedding" },
        chat: { apiKey: null, baseUrl: "https://llm.invalid", model: "wiring-chat" },
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
    supabase: wiringSettings.supabase,
    llm: wiringSettings.llm,
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
        work: refuseWiringOperation,
        wait: refuseWiringOperation,
        close: refuseWiringOperation,
    }
    return new Map<string, unknown>([
        [
            "primaryDataSource",
            { manager, isInitialized: true, query: refuseWiringOperation, createQueryRunner: refuseWiringOperation },
        ],
        ["platform.database.primary-entity-manager", manager],
        ["platform.http.client", { request: refuseWiringOperation }],
        [
            "integrations.supabase.admin-client",
            {
                auth: {
                    getUserById: refuseWiringOperation,
                    inviteUserByEmail: refuseWiringOperation,
                    listUsers: refuseWiringOperation,
                    createUser: refuseWiringOperation,
                    updateUserById: refuseWiringOperation,
                    deleteUser: refuseWiringOperation,
                },
                storage: { from: refuseWiringOperation },
            },
        ],
        ["integrations.supabase.public-client", { sendSignInLink: refuseWiringOperation }],
        ["platform.queue.transport", transport],
        ["PgmqQueueTransportClient", transport],
    ])
}

/** Resolves the diagnostic name of a registered private resource token. */
const resourceName = (token: InjectionToken): string | undefined => {
    if (typeof token === "symbol") return token.description
    if (typeof token === "function") return token.name
    return undefined
}

/** Reads private Supabase and producer-only queue tokens through their public registrations. */
const resourceOverrides = (): Array<{ token: InjectionToken; value: unknown }> => {
    const resources = resourceDoubles()
    const overrides: Array<{ token: InjectionToken; value: unknown }> = []
    const definitions = [
        SupabaseModule.register(wiringSettings.supabase),
        QueueModule.register({
            enabled: false,
            concurrency: 1,
            workspaceConcurrency: 1,
            pollIntervalMs: 500,
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
