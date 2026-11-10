import type { AgentAccess, AgentPurpose } from "./agents-connections.contracts"
import type { AgentAudience } from "./agents.contracts"

/** One connection granted to an agent, with the purpose and access of the grant. */
export interface CatalogGrant {
    /** The connection. */
    readonly connectionId: string
    /** The provider key (telegram, zalo_oa, sepay...). */
    readonly provider: string
    /** The display name of the connection. */
    readonly name: string
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** The masked bank account, when the connection is a bank feed. */
    readonly accountMasked: string | null
    /** connected, error, pending or disconnected. */
    readonly status: string
    /** What the agent may do through it. */
    readonly access: AgentAccess
    /** What the agent uses it for. */
    readonly purpose: AgentPurpose
}

/** What one agent reads of the shared knowledge, counted through its own lens. */
export interface CatalogKnowledge {
    /** Who the agent talks to: a customer-facing agent reads no internal document. */
    readonly audience: AgentAudience
    /** The documents the lens may read, public and internal. */
    readonly documents: number
    /** The facts of the lens the owner approved. */
    readonly factsApproved: number
    /** The facts of the lens, approved and waiting. */
    readonly factsTotal: number
    /** The facts of the lens that wait for the owner. */
    readonly factsWaiting: number
}

/** One agent of the catalog: what it may use and what it knows. */
export interface CatalogAgent {
    /** The agent. */
    readonly agentId: string
    /** The instance of the agent, or null when it has none. */
    readonly installationId: string | null
    /** The connections granted to the agent, one entry per grant. */
    readonly grants: ReadonlyArray<CatalogGrant>
    /** What the agent reads. */
    readonly knowledge: CatalogKnowledge
}
