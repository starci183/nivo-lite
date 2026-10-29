import { builder } from "@starci/jest-preset"
import type { AgentSummary } from "@modules/domain/agents"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The owner who installs and manages the workspace's agents. */
export const INSTALLING_MEMBER: WorkspaceMember = {
    userId: "u1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

/** An installed chatbot agent, ready and not live. */
export const installationRecordOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Front desk",
    isMulti: true,
    agentId: "agent-1",
    status: "ready",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: "version-1",
    settings: { openclawTimeoutSec: 30 },
    createdAt: "2026-10-01T00:00:00.000Z",
})

/** The agent of the installed chatbot. */
export const installAgentOf = builder<AgentSummary>({
    id: "agent-1",
    module: "chatbot",
    name: "Chatbot",
    handle: "chatbot",
    role: "Care",
    status: "active",
    avatarUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
})
