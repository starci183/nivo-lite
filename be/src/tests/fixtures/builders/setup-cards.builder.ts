import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import type { InstallationRecord } from "@modules/domain/module-installations"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import type { CardRecord, FactCardPayload } from "@modules/domain/module-setup-writes"

const NOW = "2026-10-13T02:00:00.000Z"

/** A fact proposed by a setup card. */
export const factOf: (overrides?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
    id: "fact-1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "opening-hours",
    attributeLabel: "Opening hours",
    value: "7 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 1,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Lan",
    proposedAt: NOW,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})
/** An open knowledge gap offered during setup. */
export const gapOf: (overrides?: Partial<GapRecord>) => GapRecord = builder<GapRecord>({
    id: "gap-1",
    module: "sales",
    question: "Do you take cards?",
    topic: null,
    attributeGuess: null,
    count: 3,
    firstSeenAt: NOW,
    lastSeenAt: NOW,
    exampleConversationId: null,
    status: "open",
    reopenedCount: 0,
})

/** The open setup session of the installation. */
export const SESSION: SetupSessionRecord = {
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "", facts: [] },
    gateEvidence: {},
    createdAt: NOW,
}
/** The sales installation in setup. */
export const installationOf: (overrides?: Partial<InstallationRecord>) => InstallationRecord =
    builder<InstallationRecord>({
        id: "inst-1",
        workspaceId: "ws-1",
        moduleKey: "sales",
        name: "Sales",
        isMulti: true,
        agentId: "agent-1",
        status: "setup",
        operatingMode: "assist",
        liveEnabled: false,
        activeContextVersionId: null,
        settings: {},
        createdAt: NOW,
    })

export const FACT: FactCardPayload = {
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Opening hours",
    value: "7 to 21",
    scope: "public",
}
export const CARD_BASE: Omit<CardRecord, "kind" | "payload"> = {
    id: "card-1",
    workspaceId: "ws-1",
    setupSessionId: "s-1",
    sourceMessageId: "m-1",
    gateKey: "scope",
    targetKey: "fact:shop|opening-hours",
    status: "proposed",
    result: null,
    decidedBy: null,
    createdAt: "2026-10-13T01:00:00.000Z",
}
/** A fact card of the setup session, proposed unless a status is named. */
export const factCard = (
    payload: Partial<FactCardPayload> = {},
    status: CardRecord["status"] = "proposed",
): CardRecord => ({
    ...CARD_BASE,
    status,
    kind: "fact",
    payload: { ...FACT, ...payload },
})
