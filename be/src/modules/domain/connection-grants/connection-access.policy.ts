import type { Access, Purpose } from "@modules/domain/agent-connections"

/** Lowest to highest. A new grant starts at `ask`; `auto` is never a default. */
export const ACCESS_LEVELS: ReadonlyArray<Access> = ["read", "ask", "auto"]

/** The level a new grant starts at. */
export const DEFAULT_ACCESS: Access = "ask"

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

/** The level a caller asks to store. Null removes the grant; an unknown word is stored as ask. */
export type RequestedGrant = string | null

/** One requested change: `access` null removes the agent access to the connection. */
export interface GrantChange {
    /** The agent. */
    readonly agentId: string
    /** The connection. */
    readonly connectionId: string
    /** The wanted level, or null to remove. */
    readonly access: Access | null
}

/** True for a known access level. */
export const isAccess = (value: unknown): value is Access => value === "read" || value === "ask" || value === "auto"

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

/** The level to write for a value that may be null (remove), a known level, or anything else (the default level). */
export const normaliseAccess = (value: unknown): Access | null => {
    if (value === null) return null
    if (isAccess(value)) return value
    return DEFAULT_ACCESS
}

/**
 * Turns "exactly these" into changes: a wanted id without a level keeps the current level (or starts at the default), a
 * current id that is not wanted is removed. `current` maps the other side id to its level.
 */
export const planExactly = (
    current: ReadonlyMap<string, Access>,
    wanted: ReadonlyArray<{ readonly id: string; readonly access?: Access }>,
): ReadonlyArray<{ readonly id: string; readonly access: Access | null }> => {
    const next = new Map<string, Access>(wanted.map((w) => [w.id, w.access ?? current.get(w.id) ?? DEFAULT_ACCESS]))
    return [
        ...[...next].map(([id, access]) => ({ id, access })),
        ...[...current.keys()].filter((id) => !next.has(id)).map((id) => ({ id, access: null })),
    ]
}
