import type { InboundChain } from "./agent-inbound.contracts"
import type { ChainStep } from "./agent-inbound-door.contracts"

/** The most agent wakes one chain may hold; the next event of a chain at this depth stops and a person is told. */
export const CHAIN_DEPTH_MAX = 4

/**
 * What a chain says of waking one more agent. An event that no agent led to starts a chain of one. Otherwise the chain stops at the depth
 * limit, and an agent already in the chain is woken again only for a cause the event names: the same agent for the same cause is a loop.
 */
export const stepChain = (chain: InboundChain | null, agentId: string, newChainId: () => string): ChainStep => {
    if (chain === null) {
        return { kind: "go", chain: { id: newChainId(), depth: 1, agentIds: [agentId], cause: null } }
    }
    if (chain.depth >= CHAIN_DEPTH_MAX) return { kind: "stop", reason: "depth_limit", chain }
    const seen = chain.agentIds.includes(agentId)
    if (seen && chain.cause === null) return { kind: "stop", reason: "agent_in_chain", chain }
    return {
        kind: "go",
        chain: {
            id: chain.id,
            depth: chain.depth + 1,
            agentIds: seen ? chain.agentIds : [...chain.agentIds, agentId],
            cause: chain.cause,
        },
    }
}
