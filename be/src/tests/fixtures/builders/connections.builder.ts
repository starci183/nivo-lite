import { ConnectionsErrorCode } from "@modules/domain/connections"
import type { ConnectionsService, ConnectionActor } from "@modules/domain/connections"

type ConnectionsOptions = ConstructorParameters<typeof ConnectionsService>[1]
/** URL precedence overrides accepted by the connection subject. */
export type Urls = Partial<Pick<ConnectionsOptions, "siteUrl" | "publicSiteUrl" | "publicApiUrl">>
/** Plain URLs, short suffixes and long suffixes keep the same site path. */
export const siteUrlCases = [
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
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "user-1",
    createdAt: "2026-10-01T00:00:00.000Z",
}

/** The actor, membership and refusal identities shared by connection scenarios. */
export const connectionsCase = {
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
