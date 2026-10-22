import type { AgentOwner } from "./work-chains.contracts"

/** The one door to the agents capability for who answers for an agent. The app root binds it. */
export interface ChainOwnerDirectory {
    /** The owner and the fallback of an agent. */
    ownerOf(agentId: string): Promise<AgentOwner>
}
