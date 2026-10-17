import { builder } from "@starci/jest-preset"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { GapRecord } from "@modules/domain/knowledge-gaps"

const NOW = "2026-10-13T02:00:00.000Z"

/** A fact proposed by a setup card. */
export const factOf = builder<FactRecord>({
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
export const gapOf = builder<GapRecord>({
    id: "gap-1",
    module: "accounting",
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
