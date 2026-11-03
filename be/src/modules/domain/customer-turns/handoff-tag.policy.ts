import type { AgentCard } from "@modules/domain/agents"

/** The module whose agent takes over a customer a chat agent captured. */
export const HANDOFF_TARGET_MODULE = "sales"

/** The most agents of a workspace the tag right is read from. */
export const HANDOFF_AGENTS_MAX = 200

/**
 * Whether the hand-off of a captured customer is allowed by the tag right alone: the agent holding the chat is itself a target-module
 * agent, or has one on its list of agents it may tag. Default deny: any other chat agent hands off through the owner's rule.
 */
export const handoffTagGranted = (senderId: string, agents: ReadonlyArray<AgentCard>): boolean => {
    const targets = agents.filter((agent) => agent.module === HANDOFF_TARGET_MODULE).map((agent) => agent.id)
    const sender = agents.find((agent) => agent.id === senderId)
    return targets.some((id) => id === senderId || (sender?.canTagAgentIds.includes(id) ?? false))
}
