import type { AgentKey, ScopedTx } from "./scoped-tx.contracts"

/** The agent every record this scope inserts is stamped with, or null when no agent is behind the scope. */
export const stampedAgentOf = (tx: ScopedTx): string | null => tx.agent?.id ?? null

/** The agent whose records are the only ones this scope reaches, or null when it reaches every record of the workspace. */
export const confinedAgentOf = (tx: ScopedTx): string | null => (tx.agent?.sees === "own" ? tx.agent.id : null)

/** The columns a statement adds to its key to stay inside the scope's agent: none for a scope that sees every record. */
export const agentKeyOf = (tx: ScopedTx): AgentKey => {
    const agent = confinedAgentOf(tx)
    return agent === null ? {} : { agentId: agent }
}
