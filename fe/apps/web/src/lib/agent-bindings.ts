import "server-only"
import type { Access, Purpose } from "./connection-access"
import { supabaseAdmin } from "./supabase/admin"

/**
 * The ONE resolver of "which agent listens and speaks on which connection". `agent_connections` (agent_id, connection_id, purpose,
 * access) is the single source; webhooks, the engine bridge, outbound delivery and the shifts notifier all ask here and nobody
 * reads the table or guesses "the first connected Telegram" on their own.
 *
 *   agentsFor(connectionId, purpose)   the active agents bound to a connection for that purpose, oldest first
 *   connectionsFor(agentId, purpose)   the connections an agent is bound to for that purpose
 *   routeInbound(connectionId)         inbound chat: the front door agent and the agents it hands over to
 *
 * Only active agents count. With `acting`, a binding whose access is "read" does not count (the agent may look, not act or answer).
 */
export type BoundAgent = {
    readonly id: string
    readonly module: string
    readonly name: string
    readonly access: Access
    readonly purpose: Purpose
}
export type BoundConnection = {
    readonly id: string
    readonly provider: string
    readonly name: string
    readonly status: string
    readonly access: Access
    readonly purpose: Purpose
}

const asList = (p: Purpose | ReadonlyArray<Purpose>): Array<Purpose> => (typeof p === "string" ? [p] : [...p])
const one = <T>(v: T | Array<T>): T | undefined => (Array.isArray(v) ? v[0] : v)

type AgentRow = { id: string; module: string; name: string; status: string; created_at: string }
type AgentLink = { purpose: Purpose; access: Access | null; agents: AgentRow | Array<AgentRow> }

export const agentsFor = async (
    connectionId: string,
    purpose: Purpose | ReadonlyArray<Purpose>,
    opts: { readonly acting?: boolean; readonly modules?: ReadonlyArray<string> } = {},
): Promise<Array<BoundAgent>> => {
    const { data } = await supabaseAdmin()
        .from("agent_connections")
        .select("agent_id, purpose, access, agents!inner(id, module, name, status, created_at)")
        .eq("connection_id", connectionId)
        .in("purpose", asList(purpose))
    const rows: Array<{ agent: AgentRow; access: Access; purpose: Purpose }> = []
    for (const l of (data ?? []) as unknown as Array<AgentLink>) {
        const agent = one(l.agents)
        const access: Access = l.access ?? "auto"
        if (!agent || agent.status !== "active") continue
        if (opts.acting && access === "read") continue
        if (opts.modules && !opts.modules.includes(agent.module)) continue
        rows.push({ agent, access, purpose: l.purpose })
    }
    return rows
        .sort((a, b) => a.agent.created_at.localeCompare(b.agent.created_at))
        .map((x) => ({
            id: x.agent.id,
            module: x.agent.module,
            name: x.agent.name,
            access: x.access,
            purpose: x.purpose,
        }))
}

type ConnRow = { id: string; provider: string; name: string; status: string; created_at: string }
type ConnLink = { purpose: Purpose; access: Access | null; connections: ConnRow | Array<ConnRow> }

export const connectionsFor = async (
    agentId: string,
    purpose: Purpose | ReadonlyArray<Purpose>,
    opts: {
        readonly acting?: boolean
        readonly connectedOnly?: boolean
        readonly providers?: ReadonlyArray<string>
    } = {},
): Promise<Array<BoundConnection>> => {
    const { data } = await supabaseAdmin()
        .from("agent_connections")
        .select("connection_id, purpose, access, connections!inner(id, provider, name, status, created_at)")
        .eq("agent_id", agentId)
        .in("purpose", asList(purpose))
    const rows: Array<{ conn: ConnRow; access: Access; purpose: Purpose }> = []
    for (const l of (data ?? []) as unknown as Array<ConnLink>) {
        const conn = one(l.connections)
        const access: Access = l.access ?? "auto"
        if (!conn || conn.status === "disconnected") continue
        if (opts.connectedOnly && conn.status !== "connected") continue
        if (opts.acting && access === "read") continue
        if (opts.providers && !opts.providers.includes(conn.provider)) continue
        rows.push({ conn, access, purpose: l.purpose })
    }
    return rows
        .sort((a, b) => a.conn.created_at.localeCompare(b.conn.created_at))
        .map((x) => ({
            id: x.conn.id,
            provider: x.conn.provider,
            name: x.conn.name,
            status: x.conn.status,
            access: x.access,
            purpose: x.purpose,
        }))
}

/* ------------------------------------------------------------------ inbound chat router */

/**
 * The modules that may be bound `inbound_chat` to Telegram / Zalo, in front-door order. The chatbot is the front door whenever it is
 * bound; booking and loyalty are reached by intent (a booking_request / a redeem in the model's structured reply), the same way the
 * chatbot already hands a hiring application or a loyalty redeem to its module (customer-turn.ts, engine-bridge.ts). With no chatbot
 * bound, the first of the others answers as the front door.
 */
export const INBOUND_MODULES: ReadonlyArray<string> = ["chatbot", "booking", "loyalty"]

export type InboundRoute = { readonly front: BoundAgent | null; readonly handovers: ReadonlyArray<BoundAgent> }

const rank = (a: BoundAgent): number => INBOUND_MODULES.indexOf(a.module)

/** Pure: split the bound inbound agents into the front door and the agents it hands over to (one per other module). */
export const splitRoute = (bound: ReadonlyArray<BoundAgent>): InboundRoute => {
    const sorted = bound.filter((a) => rank(a) >= 0).sort((a, b) => rank(a) - rank(b)) // stable: oldest first inside a module
    const front = sorted[0] ?? null
    return { front, handovers: front ? sorted.filter((a) => a.module !== front.module) : [] }
}

export const routeInbound = async (connectionId: string): Promise<InboundRoute> =>
    splitRoute(await agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES }))

/**
 * The agents a conversation's own agent can hand over to: those bound inbound to the connection the conversation came in on, of
 * another module than the agent itself. Empty for a conversation without a connection (website chat, the legacy env bot).
 */
export const handoversOf = async (
    connectionId: string | null,
    agent: { readonly module: string },
): Promise<Array<BoundAgent>> => {
    if (!connectionId) return []
    const bound = await agentsFor(connectionId, "inbound_chat", { acting: true, modules: INBOUND_MODULES }).catch(
        () => [] as Array<BoundAgent>,
    )
    return bound.filter((a) => a.module !== agent.module)
}
