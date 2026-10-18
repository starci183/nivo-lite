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

/** The pending live bank connection shared by connection service scenarios. */
export const ROW = {
    id: "c1",
    workspace_id: "ws-1",
    provider: "sepay",
    name: "Bank",
    public_meta: {},
    status: "pending",
    last_error: null,
    environment: "live",
    is_default: false,
    last_event_at: null,
    first_event: null,
    created_by: "user-1",
    created_at: "2026-10-01T00:00:00.000Z",
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

type QueryScenario = ReadonlyArray<readonly [string, unknown]>

/** Query scenarios shared by connection lookup and scheduling proofs. */
export const connectionsScenarios = {
    findThenMissing: (statement: string): QueryScenario => [
        [statement, [ROW]],
        [statement, []],
    ],
    syncSchedules: (statement: string): QueryScenario => [
        [statement, [{ sync_every_minutes: 15, last_sync_at: "2026-10-12T10:00:00.000Z" }]],
        [statement, [{ sync_every_minutes: null, last_sync_at: null }]],
        [statement, []],
    ],
    dueSyncOwners: (statement: string): QueryScenario => [
        [
            statement,
            [
                { id: "c2", workspace_id: "ws-2" },
                { id: "c1", workspace_id: "ws-1" },
            ],
        ],
        [statement, []],
    ],
    attachedAgentsThenMissing: (statement: string): QueryScenario => [
        [statement, [{ agent_id: "agent-2" }, { agent_id: "agent-1" }]],
        [statement, []],
    ],
}
