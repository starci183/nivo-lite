import { builder } from "@starci/jest-preset"
import type { InstallRequest } from "@modules/domain/modules"

/** What the readiness double adds to an installation record to make it a view. */
export const INSTALL_VIEWED = {
    agentName: "Chatbot",
    agentHandle: "chatbot",
    agentAvatarUrl: null,
    agentAvatarPreset: null,
    activeVersion: 1,
    connectionNeeds: [],
    lifecycle: "ready",
    setupProgress: { confirmed: 0, total: 8 },
} as const

/** An install request for the chatbot of the first workspace, in English, without a new instance. */
export const installRequestOf: (overrides?: Partial<InstallRequest>) => InstallRequest = builder<InstallRequest>({
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    locale: "en",
    newInstance: false,
    name: null,
})
