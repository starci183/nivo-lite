import { EntityEngineError, EntityEngineErrorCode } from "../errors/entity-engine.error"
import { confinedAgentOf, stampedAgentOf } from "./agent-scope.policy"
import type { ScopedTx } from "./scoped-tx.contracts"

/**
 * Refuses a write of a record type in a scope no agent is behind (`AgentMissing`): records are the mini-database of agents only, a
 * record nobody's agent owns is one no agent's tools reach. The engine's own bookkeeping is core tables, never records.
 */
export const requireAgentScope = (tx: ScopedTx, entity: string): void => {
    if (stampedAgentOf(tx) === null) {
        throw new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing, params: { entity } })
    }
}

/**
 * The agent a lookup by a declared KEY (a match key, a unique constraint) is confined to: a key is unique per workspace AND agent, so an
 * agent-scoped type is looked up among the records of the agent that writes, even in a scope that sees every record (a person acting for
 * a module), never among another agent's. Null for a scope no agent is behind.
 */
export const keyAgentOf = (tx: ScopedTx): string | null => confinedAgentOf(tx) ?? stampedAgentOf(tx)
