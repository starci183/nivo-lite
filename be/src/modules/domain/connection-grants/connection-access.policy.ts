import type { Purpose } from "@modules/domain/agent-connections"

/** module:provider -> purpose. A pair that is not listed cannot be granted. */
const PURPOSE: Readonly<Record<string, Purpose>> = {
    "chatbot:telegram": "inbound_chat",
    "chatbot:zalo_oa": "inbound_chat",
    // Booking and Loyalty can also listen on a chat connection (the chatbot stays the front door and hands over by intent).
    "booking:telegram": "inbound_chat",
    "booking:zalo_oa": "inbound_chat",
    "loyalty:telegram": "inbound_chat",
    "loyalty:zalo_oa": "inbound_chat",
    // Facebook Pages + Instagram (meta): DMs, comments and mentions reach the same front doors; lead ads go to the lead sources.
    "chatbot:meta": "inbound_chat",
    "booking:meta": "inbound_chat",
    "loyalty:meta": "inbound_chat",
    "lead_gen:meta": "lead_source",
    "sales:meta": "lead_source",
    // Shifts speaks to staff only through the connections bound to it; none bound = Office only.
    "shifts:telegram": "outbound_chat",
    "shifts:zalo_oa": "outbound_chat",
    "sales:telegram": "outbound_chat",
    "sales:zalo_oa": "outbound_chat",
    "accounting:sepay": "bank_feed",
    "accounting:payos": "bank_feed",
    "accounting:casso": "bank_feed",
}

/** Data connectors every agent may read from (a database, an API, an import, a mailbox, a personal Telegram). */
const DATA_PROVIDERS: ReadonlySet<string> = new Set(["database", "openapi", "csv_import", "imap", "telegram_user"])

/** One requested change: the agent is bound to the connection, or not. What it may do there lives in its attachment's rights. */
export interface GrantChange {
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
    /** True binds (routes the connection to the agent), false removes the binding. */
    readonly bound: boolean
}

/** True for the providers every agent may read from (data connectors), whatever its module. */
export const isDataProvider = (provider: string): boolean => DATA_PROVIDERS.has(provider)

/** The purpose a grant has, or null when that agent cannot use that provider. */
export type PairPurpose = Purpose | null

/** The purpose a grant of `provider` to an agent of `module` has, or null when that agent cannot use that provider. */
export const purposeFor = (module: string, provider: string): PairPurpose => {
    const direct = Object.hasOwn(PURPOSE, `${module}:${provider}`) ? PURPOSE[`${module}:${provider}`] : undefined
    if (direct !== undefined) return direct
    if (!DATA_PROVIDERS.has(provider)) return null
    if (provider === "openapi") return "tool"
    return "data_source"
}

/** Turns "exactly these" into changes: every wanted id is bound, every current id that is not wanted is removed. */
export const planExactly = (
    current: ReadonlySet<string>,
    wanted: ReadonlyArray<string>,
): ReadonlyArray<{ readonly id: string; readonly bound: boolean }> => {
    const next = new Set(wanted)
    return [
        ...[...next].map((id) => ({ id, bound: true })),
        ...[...current].filter((id) => !next.has(id)).map((id) => ({ id, bound: false })),
    ]
}
