import { AT, STALE, WS_A } from "./platform-admin.builder"
import { READ } from "./platform-admin-reads.builder"

/** The query stubs of the entity-manager double, keyed by the read it answers. */
export type Stubs = Record<"query", ReadonlyArray<readonly [string, unknown]>>

const workspaceDetailCore = (change: Record<string, unknown>): Stubs["query"] => [
    [
        READ.workspace,
        change.workspace ?? [
            {
                id: WS_A,
                owner_id: "o-1",
                name: "Spa Hoa Mai",
                status: "active",
                plan_code: "pro",
                paid_until: AT,
                created_at: AT,
            },
        ],
    ],
    [
        READ.members,
        [
            { user_id: "o-1", role: "owner", display_name: "Mai", status: "active", created_at: AT },
            { user_id: "o-9", role: "staff", display_name: "Ha", status: "disabled", created_at: AT },
        ],
    ],
    [READ.pendingInvites, [{ id: "i-1", email: "x@nivo.vn", role: "staff", created_at: AT, expires_at: AT }]],
    [
        READ.orders,
        change.orders ?? [
            {
                id: "ord-1",
                order_code: "NIVO1",
                plan_code: "pro",
                amount_vnd: "590000",
                status: "paid",
                created_at: AT,
                paid_at: AT,
            },
        ],
    ],
    [READ.billingEvents, [{ id: "b-1", kind: "paid", created_at: AT }]],
]

const workspaceDetailConnections = (change: Record<string, unknown>): Stubs["query"] => [
    [
        READ.installs,
        change.installs ?? [
            {
                id: "m-1",
                module_key: "chatbot",
                status: "live",
                operating_mode: "autopilot",
                live_enabled: true,
                active_context_version_id: "v-1",
                processor: "openclaw",
            },
            {
                id: "m-2",
                module_key: "sales",
                status: "setup",
                operating_mode: "suggest",
                live_enabled: false,
                active_context_version_id: null,
                processor: null,
            },
        ],
    ],
    [READ.contextVersions, [{ id: "v-1", version: 2, applied_at: AT }]],
    [
        READ.agentSync,
        [
            {
                installation_id: "m-1",
                agent_id: "agent-1",
                context_version: 2,
                checked_at: AT,
                status: "ok",
                error: null,
            },
        ],
    ],
    [
        READ.connections,
        [
            {
                id: "c-1",
                provider: "telegram",
                name: "Bot",
                status: "connected",
                environment: null,
                last_event_at: AT,
                last_error: null,
                created_at: STALE,
            },
        ],
    ],
    [READ.workspaceErrors, [{ id: "e-1", scope: "api.x", message: "boom", created_at: AT }]],
]

const workspaceDetailUsage = (change: Record<string, unknown>): Stubs["query"] => [
    [
        READ.knowledgeSources,
        [
            { kind: "text", status: "ready" },
            { kind: "text", status: "failed" },
        ],
    ],
    [READ.workspaceActivity, change.stats ?? [{ messages_7d: 4, last_customer_message_at: AT, open_decisions: 1 }]],
    [READ.quotaStatus, [{ credits_used: "10", credits_limit: "1150", cost_usd: "0.04" }]],
    [READ.quotaOverride, []],
    [READ.transfers, [{ sepay_id: "7", transfer_amount: "590000", content: "NIVO1", status: "paid", received_at: AT }]],
]

const workspaceDetailEmails = (change: Record<string, unknown>): Stubs["query"] => [
    [READ.userEmails, change.emails ?? [{ id: "o-1", email: "mai@nivo.vn" }]],
]

/** Every query of the workspace detail overview, with optional row overrides. */
export const detailStubs = (change: Record<string, unknown> = {}): Stubs => ({
    query: [
        ...workspaceDetailCore(change),
        ...workspaceDetailConnections(change),
        ...workspaceDetailUsage(change),
        ...workspaceDetailEmails(change),
    ],
})
