import { builder } from "@starci/jest-preset"
import type { InstallationRecord } from "@modules/domain/module-installations"

const NOW = "2026-10-13T02:00:00.000Z"

/** An accounting installation in setup, for the setup chat specs. */
export const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Books",
    isMulti: true,
    agentId: null,
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    settings: {},
    createdAt: NOW,
})
