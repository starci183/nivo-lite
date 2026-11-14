import { builder } from "@starci/jest-preset"
import { agentsEntities, type Installation } from "@modules/domain/agents"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

const AgentEntity: (typeof agentsEntities)[0] = agentsEntities[0]
type AgentEntity = InstanceType<typeof AgentEntity>

/** An agent row of the agents spec workspace (a chatbot named Bot, active, owned by nobody yet). */
export const agentEntityOf: (overrides?: Partial<AgentEntity>) => AgentEntity = builder<AgentEntity>({
    id: "a1",
    workspaceId: "w1",
    module: "chatbot",
    name: "Bot",
    serial: null,
    pausedByDeletion: false,
    handle: "bot",
    role: "Front desk",
    instructions: "Be kind",
    knowledge: "Open 9-5",
    greeting: "",
    approvalRule: "Ask first",
    status: "active",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    ownerMemberId: null,
    fallbackMemberId: null,
    assignableRoles: ["owner", "manager"],
    assignableRooms: [],
    avatarUrl: null,
    avatarPreset: null,
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** An installation of the agents spec workspace, driven by agent a1. */
export const agentInstallationOf: (overrides?: Partial<Installation>) => Installation = builder<Installation>({
    id: "i1",
    workspaceId: "w1",
    module: "chatbot",
    name: "Chatbot Q1",
    isMulti: true,
    agentId: "a1",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
    liveEnabled: false,
    removed: false,
})

/** The manager who reads the agents spec dashboards. */
export const agentMemberOf: (overrides?: Partial<WorkspaceMember>) => WorkspaceMember = builder<WorkspaceMember>({
    userId: "u1",
    workspaceId: "w1",
    role: "manager",
    staffId: null,
    displayName: "Lan",
    status: "active",
})

/** The document and fact counts a knowledge lens answers for a customer-facing agent. */
export const AGENT_LENS_COUNTS = {
    audience: "customer" as const,
    documents: { public: 1, internal: 0 },
    facts: { public: 2, internal: 0, restricted: 0 },
}

type AgentOpenGapsItemsShape = {
    id: string
    question: string
    count: number
    lastSeenAt: string
}

type AgentOpenGapsShape = {
    openCount: number
    items: Array<AgentOpenGapsItemsShape>
}

/** The open knowledge gaps a knowledge lens answers for that agent. */
export const AGENT_OPEN_GAPS: AgentOpenGapsShape = {
    openCount: 2,
    items: [{ id: "g1", question: "Opening hours?", count: 3, lastSeenAt: "2026-10-11T00:00:00.000Z" }],
}

/** AI Sales, the agent the ownership scenarios start from: owned by Minh, Nam as the fallback, open to owners and managers. */
export const ownedAgentOf: (overrides?: Partial<AgentEntity>) => AgentEntity = builder<AgentEntity>({
    ...agentEntityOf(),
    id: "a1",
    workspaceId: "w1",
    name: "AI Sales",
    ownerMemberId: "m-minh",
    fallbackMemberId: "m-nam",
    assignableRoles: ["owner", "manager"],
    assignableRooms: ["sales"],
})

/** AI Sales before anybody owns it. */
export const ownerlessAgent = (): AgentEntity => ownedAgentOf({ ownerMemberId: null, fallbackMemberId: null })

/** AI Sales as another workspace holds it. */
export const agentOfOtherWorkspace = (): AgentEntity => ownedAgentOf({ workspaceId: "w2" })

/** An agent a member may be handed work for: open to the owner and manager roles and the sales room. */
export const openAgentOf: (overrides?: Partial<AgentEntity>) => AgentEntity = builder<AgentEntity>({
    ...agentEntityOf(),
    id: "a1",
    workspaceId: "w1",
    assignableRoles: ["owner", "manager"],
    assignableRooms: ["sales"],
})

/** The open agent when no room may be handed work. */
export const roomlessOpenAgent = (): AgentEntity => openAgentOf({ assignableRooms: [] })

/** The stored agent a9 whose instructions are the given text. */
export const agentHoldingInstructions = (instructions: string): AgentEntity => agentEntityOf({ id: "a9", instructions })

/** The agent a2 named Lan of the shifts module. */
export const lanAgent = (): AgentEntity => agentEntityOf({ id: "a2", name: "Lan", module: "shifts" })

/** The agent a1 created at the given moment. */
export const agentCreatedAt = (createdAt: Date): AgentEntity => agentEntityOf({ createdAt })
