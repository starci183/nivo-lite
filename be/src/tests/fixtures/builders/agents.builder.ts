import { builder } from "@starci/jest-preset"
import type { Installation } from "@modules/domain/agents"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** An installation of the agents spec workspace, driven by agent a1. */
export const agentInstallationOf = builder<Installation>({
    id: "i1",
    workspaceId: "w1",
    module: "chatbot",
    name: "Chatbot Q1",
    isMulti: true,
    agentId: "a1",
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
})

/** The manager who reads the agents spec dashboards. */
export const agentMemberOf = builder<WorkspaceMember>({
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

/** The open knowledge gaps a knowledge lens answers for that agent. */
export const AGENT_OPEN_GAPS = {
    openCount: 2,
    items: [{ id: "g1", question: "Opening hours?", count: 3, lastSeenAt: "2026-10-11T00:00:00.000Z" }],
}

/** One connection bound to that agent, as the agent bindings answer it. */
export const AGENT_BOUND_CONNECTION = {
    id: "c1",
    provider: "telegram",
    name: "Shop bot",
    status: "connected",
    access: "auto" as const,
    purpose: "inbound_chat" as const,
    botUsername: null,
    accountMasked: null,
}
