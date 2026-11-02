import { builder } from "@starci/jest-preset"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"

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

/** A draft setup revision at the same deterministic moment as its installation. */
export const setupSessionOf = builder<SetupSessionRecord>({
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "A bakery.", facts: [] },
    gateEvidence: {},
    createdAt: NOW,
})

/** A member's message in the setup revision, with deterministic identity and time. */
export const setupMessageOf = builder<SetupMessageRecord>({
    id: "m-1",
    setupSessionId: "s-1",
    role: "user",
    author: "Lan",
    body: "Hello",
    createdAt: NOW,
})
