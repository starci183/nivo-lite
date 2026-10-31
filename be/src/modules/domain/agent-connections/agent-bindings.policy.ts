import type {
    Access,
    AgentsForOptions,
    BoundAgent,
    BoundAgentFacts,
    BoundConnection,
    BoundConnectionFacts,
    ConnectionsForOptions,
    InboundRoute,
    Purpose,
    PurposeSelector,
} from "./agent-connections.contracts"

/**
 * The modules that may be bound inbound_chat to a chat connection, in front-door order. The chatbot is the front door whenever it
 * is bound; booking, loyalty and sales are reached by intent, and the conversation lock keeps two of them from answering one message:
 * the chatbot hands the conversation over to Sales and the customer sees one thread. With no chatbot bound, the first of the others
 * answers as the front door. A Sales agent on a channel is customer-facing: it reads public knowledge only.
 */
export const INBOUND_MODULES: ReadonlyArray<string> = ["chatbot", "booking", "loyalty", "sales"]

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

/** True when a stored text is one of the three access levels. */
export const isAccess = (value: string): value is Access => value === "read" || value === "ask" || value === "auto"

/** The purposes a selector names, as a list. */
export const purposesOf = (selector: PurposeSelector): ReadonlyArray<Purpose> =>
    typeof selector === "string" ? [selector] : selector

/** Anything that is not a known access level counts as the least one: an agent may look, not act. */
const accessOf = (value: string): Access => (isAccess(value) ? value : "read")

const byCreatedAt = <T extends { readonly created_at: string }>(a: T, b: T): number =>
    a.created_at.localeCompare(b.created_at)

const agentOf = (row: BoundAgentFacts, purpose: Purpose): BoundAgent => ({
    id: row.id,
    module: row.module,
    name: row.name,
    access: accessOf(row.access),
    purpose,
})

const connectionOf = (row: BoundConnectionFacts, purpose: Purpose): BoundConnection => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    botUsername: row.bot_username,
    accountMasked: row.account_masked,
    status: row.status,
    access: accessOf(row.access),
    purpose,
})

/** The bound agents that count, oldest first. */
export const boundAgentsOf = (
    rows: ReadonlyArray<BoundAgentFacts>,
    options: AgentsForOptions,
): ReadonlyArray<BoundAgent> =>
    [...rows]
        .sort(byCreatedAt)
        .filter((row) => !(options.acting === true && accessOf(row.access) === "read"))
        .filter((row) => options.modules === undefined || options.modules.includes(row.module))
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
        .filter((row) => !(options.acting === true && accessOf(row.access) === "read"))
        .filter((row) => options.providers === undefined || options.providers.includes(row.provider))
        .flatMap((row) => (isPurpose(row.purpose) ? [connectionOf(row, row.purpose)] : []))

const rank = (agent: BoundAgent): number => INBOUND_MODULES.indexOf(agent.module)

/** Splits the bound inbound agents into the front door and the agents it hands over to (one per other module). */
export const splitRoute = (bound: ReadonlyArray<BoundAgent>): InboundRoute => {
    const sorted = bound.filter((agent) => rank(agent) >= 0).sort((a, b) => rank(a) - rank(b))
    const front = sorted[0] ?? null
    return { front, handovers: front === null ? [] : sorted.filter((agent) => agent.module !== front.module) }
}

/** The agents a conversation's own agent can hand over to: the bound ones of another module. */
export const handoversFrom = (bound: ReadonlyArray<BoundAgent>, module: string): ReadonlyArray<BoundAgent> =>
    bound.filter((agent) => agent.module !== module)
