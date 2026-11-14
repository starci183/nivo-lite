import {
    ConnectionsErrorCode,
    connectionsEntities,
    type ConnectionsService,
    type ConnectionActor,
} from "@modules/domain/connections"
import { entityOf } from "./entity.builder"

type ConnectionsOptions = ConstructorParameters<typeof ConnectionsService>[1]
/** URL precedence overrides accepted by the connection subject. */
export type Urls = Partial<Pick<ConnectionsOptions, "siteUrl" | "publicSiteUrl" | "publicApiUrl">>
/** Plain URLs, short suffixes and long suffixes keep the same site path. */
export const siteUrlCases: readonly [
    readonly ["https://site.example.com", "https://site.example.com"],
    readonly ["https://nivo.vn/app///", "https://nivo.vn/app"],
    readonly [string, "https://site.example.com/path"],
] = [
    ["https://site.example.com", "https://site.example.com"],
    ["https://nivo.vn/app///", "https://nivo.vn/app"],
    ["https://site.example.com/path" + "/".repeat(20_000), "https://site.example.com/path"],
] as const

/** The pending live bank connection, as the projection query answers it. */
export const ROW = {
    id: "c1",
    workspaceId: "ws-1",
    provider: "sepay",
    name: "Bank",
    publicMeta: {},
    status: "pending",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "user-1",
    createdAt: "2026-10-01T00:00:00.000Z",
}

type ConnectionsCaseMissingShape = {
    code: ConnectionsErrorCode
}

type ConnectionsCaseActorShape = {
    principalId: string
    workspaceId: string
}

type ConnectionsCaseCreateInputSecretShape = {
    plain: string
    webhookSecret: string
}

type ConnectionsCaseCreateInputMetaShape = {
    bot_id: string
}

type ConnectionsCaseCreateInputShape = {
    workspaceId: string
    createdBy: string
    provider: "telegram"
    name: string
    status: "connected"
    environment: "live"
    meta: ConnectionsCaseCreateInputMetaShape
    secret: ConnectionsCaseCreateInputSecretShape
}

type ConnectionsCaseShape = {
    createInput: ConnectionsCaseCreateInputShape
    actor: ConnectionsCaseActorShape
    forbidden: ConnectionsCaseMissingShape
    invalidName: ConnectionsCaseMissingShape
    missing: ConnectionsCaseMissingShape
}

/** The actor, membership and refusal identities shared by connection scenarios. */
export const connectionsCase: ConnectionsCaseShape = {
    createInput: {
        workspaceId: "ws-1",
        createdBy: "user-1",
        provider: "telegram" as const,
        name: "  Shop bot ",
        status: "connected" as const,
        environment: "live" as const,
        meta: { bot_id: "7" },
        secret: { plain: "token", webhookSecret: "hook" },
    },
    actor: { principalId: "user-1", workspaceId: "ws-1" } satisfies ConnectionActor,

    forbidden: { code: ConnectionsErrorCode.Forbidden },
    invalidName: { code: ConnectionsErrorCode.NameInvalid },
    missing: { code: ConnectionsErrorCode.NotFound },
}

const ConnectionEntity: (typeof connectionsEntities)[0] = connectionsEntities[0]
type ConnectionEntity = InstanceType<typeof ConnectionEntity>

/** A connected Telegram bot as the bindings read answers it, with a padded username and a blank masked account. */
export const botConnectionOf: (overrides?: Partial<ConnectionEntity>) => ConnectionEntity = entityOf(ConnectionEntity, {
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    publicMeta: { bot_username: "  shop_bot ", account_masked: "   ", other: 3 },
})

/** The same bot whose reported username is not text. */
export const numericUsernameConnectionOf = (): ConnectionEntity => botConnectionOf({ publicMeta: { bot_username: 5 } })

/** The same bot, live, in workspace w1. */
export const liveBotConnectionOf = (): ConnectionEntity => botConnectionOf({ workspaceId: "w1", environment: "live" })

/** A connected Telegram connection of workspace ws-1 as the secret reads find it. */
export const secretConnectionOf: (overrides?: Partial<ConnectionEntity>) => ConnectionEntity = entityOf(
    ConnectionEntity,
    {
        id: "c-1",
        workspaceId: "ws-1",
        provider: "telegram",
        status: "connected",
    },
)

/** The second connection of that workspace. */
export const secondSecretConnectionOf = (): ConnectionEntity => secretConnectionOf({ id: "c-2" })
