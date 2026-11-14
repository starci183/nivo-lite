import type { ScopedTx } from "@modules/domain/entity-engine"
import type {
    EnsuredGraph,
    GraphInsert,
    GraphPatch,
    GraphRecord,
    GraphSourceRecord,
    ProposalInsert,
    ProposalPatch,
    ProposalRecord,
    ProposalStatusFilter,
    SourceInsert,
    VersionInsert,
    VersionRecord,
} from "./agent-graphs-records.contracts"

/** How one graph is found: by its agent, or by the installation the agent runs as. */
export type GraphLookup = { readonly agentId: string } | { readonly installationId: string }

/**
 * The graphs of the agents and what hangs off them (public.agent_graphs, agent_graph_versions, agent_graph_sources,
 * agent_graph_proposals). Every member runs in the transaction of the `ScopedTx` it is given, on the workspace it
 * names, and never opens one. A write under a fence answers null when the row moved on (nothing written).
 */
export interface AgentGraphStore {
    /** The graph found by its agent or its installation, or null. */
    graph(tx: ScopedTx, lookup: GraphLookup): Promise<GraphRecord | null>
    /** The graphs of these agents (every agent of the workspace when null), in the order of their agents, at most `limit`. */
    graphs(tx: ScopedTx, agentIds: ReadonlyArray<string> | null, limit: number): Promise<ReadonlyArray<GraphRecord>>
    /** The graph of the agent, written when it has none. */
    ensureGraph(tx: ScopedTx, graph: GraphInsert): Promise<EnsuredGraph>
    /** Writes members of a graph at the fence read. */
    patchGraph(tx: ScopedTx, id: string, fence: string, patch: GraphPatch): Promise<GraphRecord | null>
    /** One version, or null. */
    version(tx: ScopedTx, id: string): Promise<VersionRecord | null>
    /** The versions of the agent, newest first, at most `limit`. */
    versions(tx: ScopedTx, agentId: string, limit: number): Promise<ReadonlyArray<VersionRecord>>
    /** Writes a version; null when the agent holds its number already. */
    addVersion(tx: ScopedTx, version: VersionInsert): Promise<VersionRecord | null>
    /** Indexes one source of a version; false when the version holds that source already. */
    insertSource(tx: ScopedTx, source: SourceInsert): Promise<boolean>
    /** At most `limit` sources of one kind among these versions, in the order of the versions. */
    sources(
        tx: ScopedTx,
        kind: string,
        versionIds: ReadonlyArray<string>,
        limit: number,
    ): Promise<ReadonlyArray<GraphSourceRecord>>
    /** One proposal, or null. */
    proposal(tx: ScopedTx, id: string): Promise<ProposalRecord | null>
    /** The proposals of the agent in these statuses (of one kind when named): newest first, or by status when `byStatus`; at most `limit`. */
    proposals(tx: ScopedTx, filter: ProposalStatusFilter, limit: number): Promise<ReadonlyArray<ProposalRecord>>
    /** Writes a proposal once per agent and cause: true when this call wrote it. */
    raiseProposal(tx: ScopedTx, proposal: ProposalInsert): Promise<boolean>
    /** Writes members of a proposal at the fence read. */
    patchProposal(tx: ScopedTx, id: string, fence: string, patch: ProposalPatch): Promise<ProposalRecord | null>
}

/** The injection token of the graph store. */
export const AGENT_GRAPH_STORE: unique symbol = Symbol("AGENT_GRAPH_STORE")
