import type {
    BoundAgent,
    BoundAgentFacts,
    BoundConnection,
    BoundConnectionFacts,
    ConnectionsForOptions,
    InboundRoute,
    Purpose,
    PurposeSelector,
} from "./agent-connections.contracts"

/** Every purpose a binding can have. */
export const PURPOSES: ReadonlyArray<Purpose> = [
    "inbound_chat",
    "outbound_chat",
    "bank_feed",
    "data_source",
    "tool",
    "lead_source",
]

/** True when a stored text is one of the purposes. */
export const isPurpose = (value: string): value is Purpose => {
    const purposes: ReadonlyArray<string> = PURPOSES
    return purposes.includes(value)
}

/** The purposes a selector names, as a list. */
export const purposesOf = (selector: PurposeSelector): ReadonlyArray<Purpose> =>
    typeof selector === "string" ? [selector] : selector

const byCreatedAt = <T extends { readonly created_at: string }>(a: T, b: T): number =>
    a.created_at.localeCompare(b.created_at)

const agentOf = (row: BoundAgentFacts, purpose: Purpose): BoundAgent => ({
    id: row.id,
    module: row.module,
    name: row.name,
    purpose,
})

const connectionOf = (row: BoundConnectionFacts, purpose: Purpose): BoundConnection => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    botUsername: row.bot_username,
    accountMasked: row.account_masked,
    status: row.status,
    purpose,
})

/** The bound agents that count, oldest first. */
export const boundAgentsOf = (rows: ReadonlyArray<BoundAgentFacts>): ReadonlyArray<BoundAgent> =>
    [...rows]
        .sort(byCreatedAt)
        .flatMap((row) => (isPurpose(row.purpose) ? [agentOf(row, row.purpose)] : []))

/** The bound connections that count, oldest first; a disconnected connection never counts. */
export const boundConnectionsOf = (
    rows: ReadonlyArray<BoundConnectionFacts>,
    options: ConnectionsForOptions,
): ReadonlyArray<BoundConnection> =>
    [...rows]
        .sort(byCreatedAt)
        .filter((row) => row.status !== "disconnected")
        .filter((row) => !(options.connectedOnly === true && row.status !== "connected"))
        .filter((row) => options.providers === undefined || options.providers.includes(row.provider))
        .flatMap((row) => (isPurpose(row.purpose) ? [connectionOf(row, row.purpose)] : []))

/**
 * The inbound route of a connection: each customer channel has ONE front door (one agent holds its inbound binding, enforced where a
 * binding is written, see `channel-ownership.policy`), so the front door is the first bound inbound agent, oldest first. There is no
 * second agent to hand over to: another agent is reached through the front door's graph (`callWorkflow`), never by a second binding.
 */
export const routeOf = (bound: ReadonlyArray<BoundAgent>): InboundRoute => ({ front: bound[0] ?? null, handovers: [] })
