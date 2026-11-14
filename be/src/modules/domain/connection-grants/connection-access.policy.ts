import type { Purpose } from "@modules/domain/agent-connections"
import {
    INSTALLED,
    bankFeedProviders,
    customerChannelProviders,
    inboundChannelsOf,
    type ChannelAgent,
} from "@modules/domain/installed-plugins"

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

/**
 * The pairs that can be bound are read from the installation, never listed by hand: a template agent that lists the provider among its
 * `accounts` may be bound to a connection of it, and the purpose follows from what its graphs declare. It answers the connection's inbound
 * chat when a graph wakes on a customer message of that provider (`inbound_chat`); a customer channel it only lists is one it writes on
 * (`outbound_chat`); a bank feed it lists is `bank_feed`. Anything else it lists is attached through its provider rights, not bound here.
 * The data connectors every agent may read from are a fact of the provider, not of a module.
 */
export const purposeOfAgent = (agent: ChannelAgent | null, provider: string): PairPurpose => {
    if (agent?.accounts.includes(provider) === true) {
        if (inboundChannelsOf(agent).has(provider)) return "inbound_chat"
        if (customerChannelProviders().has(provider)) return "outbound_chat"
        if (bankFeedProviders().has(provider)) return "bank_feed"
    }
    if (!DATA_PROVIDERS.has(provider)) return null
    return provider === "openapi" ? "tool" : "data_source"
}

/** The purpose a grant of `provider` to an agent of `module` has, or null when that agent cannot use that provider. */
export const purposeFor = (module: string, provider: string): PairPurpose =>
    purposeOfAgent(INSTALLED.templateAgentOf(module), provider)

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
