import type { Installation } from "@modules/domain/agents"

/** The workspace of the runtime specs. */
export const RUNTIME_WS = "11111111-1111-4111-8111-111111111111"

/** An installation of the turn's agent with the given settings. */
export const runtimeInstallationOf = (settings: Installation["settings"] = {}): Installation => ({
    id: "inst-1",
    workspaceId: RUNTIME_WS,
    module: "chatbot",
    name: "Bot",
    isMulti: false,
    agentId: "a1",
    operatingMode: "assist",
    settings,
    activeContextVersionId: "version-1",
    liveEnabled: true,
    removed: false,
})
