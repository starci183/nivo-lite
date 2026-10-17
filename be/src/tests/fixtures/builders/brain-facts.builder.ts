/** Database answer sequences used by fact scenarios. */
type FactDatabaseStubs = Record<"query", readonly [string, unknown] | ReadonlyArray<readonly [string, unknown]>>

import {
    INSERT_FACT,
    SELECT_FACT,
    SELECT_FACTS,
    SELECT_FACTS_BY_KEY,
    SUPERSEDE_FACT,
    CLOSE_RETIRE_PROPOSAL,
    EXPIRE_DUE_FACTS,
    PROMOTE_FACT,
    RETIRE_FACT,
    SELECT_DUE_FACTS,
} from "../../../modules/domain/brain-facts/persistence/brain-facts.sql"
import { builder } from "@starci/jest-preset"
import type { Evidence, FactInput, FactRecord } from "@modules/domain/brain-facts"
import type { BrainFactRow } from "../../../modules/domain/brain-facts/persistence/brain-facts.rows"

/** Shared, complete test data for the capability cases. */
export const WS = "ws-1"

/** Shared, complete test data for the capability cases. */
export const AT = "2026-10-12T10:00:00.000Z"

/** Shared, complete test data for the capability cases. */
export const LATER = "2026-10-13T10:00:00.000Z"

/** Shared, complete test data for the capability cases. */
export const PROOF: Evidence = { kind: "document", ref: "doc-1", label: "Hours" }

/** Shared, complete test data for the capability cases. */
export const inputOf = builder<FactInput>({
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8h",
    sourceKind: "staff",
    proposedBy: "u1",
})

/** Shared, complete test data for the capability cases. */
export const rowOf = builder<BrainFactRow>({
    id: "f1",
    workspace_id: WS,
    installation_id: null,
    subject_type: "business",
    subject_key: "shop",
    subject_label: "Shop",
    attribute: "hours",
    attribute_label: "Hours",
    value: "8h",
    value_number: 8,
    unit: null,
    scope: "internal",
    modules: [],
    status: "proposed",
    source_kind: "staff",
    trust: 60,
    valid_from: null,
    valid_to: null,
    supersedes_id: null,
    conflict_with: null,
    proposal_kind: "set",
    evidence: [],
    proposed_by: "u1",
    proposed_at: AT,
    decided_by: null,
    decided_at: null,
    decision_note: null,
})

/** Shared, complete test data for the capability cases. */
export const factOf = builder<FactRecord>({
    id: "f1",
    installationId: null,
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8h",
    valueNumber: 8,
    unit: null,
    scope: "internal",
    modules: [],
    status: "proposed",
    sourceKind: "staff",
    trust: 60,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "u1",
    proposedAt: AT,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

/** Shared, complete test data for the capability cases. */
export const OTHER: Evidence = { kind: "manual", ref: "doc-1", label: "Owner" }

/** Shared, complete test data for the capability cases. */
export const withdrawalRows = [
    rowOf({ evidence: [PROOF] }),
    rowOf({ id: "orphan", status: "active", source_kind: "document", evidence: [PROOF] }),
    rowOf({ id: "owner", status: "active", source_kind: "owner", evidence: [PROOF] }),
    rowOf({ id: "scheduled", status: "scheduled", evidence: [PROOF] }),
    rowOf({
        id: "supported",
        status: "active",
        evidence: [PROOF, OTHER, { ...PROOF, ref: "doc-2" }],
    }),
]

/** Shared, complete test data for the capability cases. */
export const splitProposal = {
    subjectType: "business",
    subjectLabel: "Shop",
    attributeLabel: "Hours (Weekend)",
    value: "8h",
    unit: null,
    scope: "internal",
    modules: [],
    sourceKind: "staff",
    validFrom: null,
    validTo: null,
    evidence: [],
    proposedBy: "u1",
    installationId: null,
    autoApply: true,
}

/** Shared, complete test data for the capability cases. */
export const retirementInsert = [
    WS,
    "business",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    null,
    "internal",
    ["sales"],
    "document",
    75,
    null,
    null,
    "f1",
    JSON.stringify([PROOF]),
    "u2",
    "i1",
    "retire",
]

/** Shared, complete test data for the capability cases. */
export const explicitInsert = [
    WS,
    "product",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    "hours",
    "restricted",
    ["chatbot"],
    "staff",
    60,
    AT,
    LATER,
    null,
    JSON.stringify([PROOF]),
    "u1",
    "i1",
    "set",
]

/** Shared, complete test data for the capability cases. */
export const orphanInsert = [
    WS,
    "business",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    null,
    "internal",
    [],
    "document",
    75,
    null,
    null,
    "file",
    JSON.stringify([PROOF]),
    "NIVO",
    null,
    "retire",
]

/** Shared, complete test data for the capability cases. */
export const conflictInsert = [
    WS,
    "service",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    "hour",
    "restricted",
    ["sales"],
    "staff",
    60,
    null,
    null,
    "old",
    "[]",
    "u1",
    null,
    "set",
]

/** Shared, complete test data for the capability cases. */
export const restrictedInsert = [
    WS,
    "business",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    null,
    "restricted",
    [],
    "staff",
    60,
    null,
    null,
    null,
    "[]",
    "u1",
    null,
    "set",
]

/** Shared, complete test data for the capability cases. */
export const ordinaryInsert = [
    WS,
    "business",
    "shop",
    "Shop",
    "hours",
    "Hours",
    "8h",
    8,
    null,
    "internal",
    [],
    "staff",
    60,
    null,
    null,
    null,
    "[]",
    "u1",
    null,
    "set",
]

/** Shared, complete test data for the capability cases. */
export const explicitInput = {
    subjectType: "product",
    scope: "restricted",
    modules: ["chatbot"],
    unit: " hours ",
    validFrom: AT,
    validTo: LATER,
    evidence: [PROOF],
    installationId: "i1",
    autoApply: true,
} satisfies Partial<FactInput>

/** Fresh database answers for one complete fact scenario. */
export const orphanStubs = (): FactDatabaseStubs => ({
    query: [
        [SELECT_FACT, []],
        [SELECT_FACT, [rowOf()]],
        [SELECT_FACT, [rowOf({ status: "active", evidence: [PROOF] })]],
        [SELECT_FACT, [rowOf({ status: "active", id: "value" })]],
        [SELECT_FACT, [rowOf({ status: "active", id: "retire" })]],
        [SELECT_FACT, [rowOf({ status: "active", id: "file" })]],
        [SELECT_FACTS_BY_KEY, [rowOf()]],
        [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" })]],
        [SELECT_FACTS_BY_KEY, [rowOf({ proposal_kind: "retire" })]],
        [SELECT_FACTS_BY_KEY, []],
        [SELECT_FACTS_BY_KEY, []],
        [INSERT_FACT, []],
    ],
})

/** Fresh database answers for one complete fact scenario. */
export const maintenanceStubs = (): FactDatabaseStubs => ({
    query: [
        [SELECT_DUE_FACTS, [rowOf(), rowOf({ id: "f2" })]],
        [SELECT_FACTS_BY_KEY, [rowOf({ id: "old1" }), rowOf({ id: "old2" })]],
        [SELECT_FACTS_BY_KEY, []],
        [SUPERSEDE_FACT, []],
        [PROMOTE_FACT, [rowOf({ status: "active" })]],
        [PROMOTE_FACT, []],
        [EXPIRE_DUE_FACTS, [{ id: "e1" }, { id: "e2" }]],
    ],
})

/** Fresh database answers for one complete fact scenario. */
export const retirementStubs = (): FactDatabaseStubs => ({
    query: [
        [SELECT_FACT, [rowOf({ proposal_kind: "retire" })]],
        [SELECT_FACTS_BY_KEY, [rowOf({ id: "old" })]],
        [RETIRE_FACT, [rowOf({ status: "expired" })]],
        [CLOSE_RETIRE_PROPOSAL, [rowOf({ status: "expired" })]],
    ],
})

/** Fresh database answers for one complete fact scenario. */
export const viewStubs = (): FactDatabaseStubs => ({
    query: [
        SELECT_FACTS,
        [
            rowOf({ scope: "public", status: "active" }),
            rowOf({ id: "future", valid_from: LATER }),
            rowOf({ id: "private", scope: "internal" }),
        ],
    ],
})

/** Exact arguments when a source confirms the current value again. */
export const confirmedValue = [WS, "shop", "hours", null, "A source confirmed this value again"]

/** The active restricted value inherited by a conflicting proposal. */
export const conflictingActive = rowOf({
    id: "old",
    value: "9h",
    subject_type: "service",
    scope: "restricted",
    modules: ["sales"],
    unit: "hour",
})
