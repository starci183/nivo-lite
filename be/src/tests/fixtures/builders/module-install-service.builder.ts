import { builder } from "@starci/jest-preset"
import type { AgentSyncStatus } from "@modules/domain/module-installations"
import type { InstallRequest } from "@modules/domain/modules"

/** What the readiness double adds to an installation record to make it a view. */
export const INSTALL_VIEWED = {
    agentName: "Chatbot",
    agentHandle: "chatbot",
    agentAvatarUrl: null,
    activeVersion: 1,
    connectionNeeds: [],
    lifecycle: "ready",
    setupProgress: { confirmed: 0, total: 8 },
} as const

/** An install request for the chatbot of the first workspace, in English, without a new instance. */
export const installRequestOf = builder<InstallRequest>({
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    locale: "en",
    newInstance: false,
    name: null,
})

/** A copy in sync with the active version. */
export const SYNCED_AGENT_COPY: AgentSyncStatus = {
    state: "ok",
    syncedVersion: 1,
    activeVersion: 1,
    checkedAt: null,
    error: null,
}
