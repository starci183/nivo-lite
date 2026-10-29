import { builder } from "@starci/jest-preset"
import { agentConnectionsEntities } from "@modules/domain/agent-connections"

const [AgentConnectionEntity] = agentConnectionsEntities
type AgentConnectionEntity = InstanceType<typeof AgentConnectionEntity>

/** The grant of connection c1 to agent a1 for inbound chat at the auto level, in workspace w1. */
export const linkOf = builder<AgentConnectionEntity>({
    agentId: "a1",
    connectionId: "c1",
    workspaceId: "w1",
    purpose: "inbound_chat",
    access: "auto",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
})

/** The inbound chat grants of connection c1 to the agents a1, a2 and a3. */
export const inboundLinks = (): Array<AgentConnectionEntity> => ["a1", "a2", "a3"].map((agentId) => linkOf({ agentId }))

/** The grants of the connections c1, c2 and c3 to agent a1 for outbound chat. */
export const outboundLinks = (): Array<AgentConnectionEntity> =>
    ["c1", "c2", "c3"].map((connectionId) => linkOf({ connectionId, purpose: "outbound_chat" }))

/** The read-only outbound chat grant of connection c1 to agent a1. */
export const readOnlyOutboundLink = (): AgentConnectionEntity =>
    linkOf({ connectionId: "c1", purpose: "outbound_chat", access: "read" })

/** The tool grant of connection c1 to agent a1. */
export const toolLink = (): AgentConnectionEntity => linkOf({ purpose: "tool" })

/** The grants of connection c1 to agents agent-2 and agent-1, in that order. */
export const twoAgentLinks = (): Array<AgentConnectionEntity> => [
    linkOf({ agentId: "agent-2" }),
    linkOf({ agentId: "agent-1" }),
]

/** The ask-level grant of connection c1 to agent a1. */
export const askLink = (): AgentConnectionEntity => linkOf({ access: "ask" })
