import {
    type Evidence,
    type FactInput,
    type FactRecord,
    type BrainSubjectType,
    type Scope,
    type FactStatus,
    type FactSource,
    type FactProposalKind,
    brainFactsEntities,
} from "@modules/domain/brain-facts"
import { builder } from "@starci/jest-preset"
import { entityRowBuilder } from "./entity-row.builder"

const BrainFactEntity: (typeof brainFactsEntities)[0] = brainFactsEntities[0]
type BrainFactEntity = InstanceType<typeof BrainFactEntity>

/** Shared, complete test data for the capability cases. */
export const WS = "ws-1"

/** Shared, complete test data for the capability cases. */
export const AT = "2026-10-12T10:00:00.000Z"

/** Shared, complete test data for the capability cases. */
export const LATER = "2026-10-13T10:00:00.000Z"

/** Shared, complete test data for the capability cases. */
export const PROOF: Evidence = { kind: "document", ref: "doc-1", label: "Hours" }

/** Shared, complete test data for the capability cases. */
export const inputOf: (overrides?: Partial<FactInput>) => FactInput = builder<FactInput>({
    subjectLabel: "Shop",
    attributeLabel: "Hours",
    value: "8h",
    sourceKind: "staff",
    proposedBy: "u1",
})

type RowOfShape = {
    readonly workspaceId?: string
    readonly installationId?: string | null
    readonly subjectType?: BrainSubjectType
    readonly subjectKey?: string
    readonly subjectLabel?: string
    readonly attribute?: string
    readonly attributeLabel?: string
    readonly value?: string
    readonly valueNumber?: string | null
    readonly unit?: string | null
    readonly scope?: Scope
    readonly modules?: Array<string>
    readonly status?: FactStatus
    readonly sourceKind?: FactSource
    readonly trust?: number
    readonly validFrom?: Date | null
    readonly validTo?: Date | null
    readonly supersedesId?: string | null
    readonly conflictWith?: string | null
    readonly evidence?: Array<Evidence>
    readonly proposedBy?: string
    readonly proposedAt?: Date
    readonly decidedBy?: string | null
    readonly decidedAt?: Date | null
    readonly decisionNote?: string | null
    readonly proposalKind?: FactProposalKind
    readonly id?: string
    readonly createdAt?: Date
    readonly updatedAt?: Date
}

/** Shared, complete test data for the capability cases. */
export const rowOf: (changes?: RowOfShape) => BrainFactEntity = entityRowBuilder<BrainFactEntity>({
    id: "f1",
    workspaceId: WS,
    installationId: null,
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8h",
    valueNumber: "8",
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
    proposedAt: new Date(AT),
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    updatedAt: new Date(AT),
    createdAt: new Date(AT),
})

/** Shared, complete test data for the capability cases. */
export const factOf: (overrides?: Partial<FactRecord>) => FactRecord = builder<FactRecord>({
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
export const withdrawalRows: Array<BrainFactEntity> = [
    rowOf({ evidence: [PROOF] }),
    rowOf({ id: "orphan", status: "active", sourceKind: "document", evidence: [PROOF] }),
    rowOf({ id: "owner", status: "active", sourceKind: "owner", evidence: [PROOF] }),
    rowOf({ id: "scheduled", status: "scheduled", evidence: [PROOF] }),
    rowOf({ id: "supported", status: "active", evidence: [PROOF, OTHER, { ...PROOF, ref: "doc-2" }] }),
]

type SplitProposalShape = {
    subjectType: string
    subjectLabel: string
    attributeLabel: string
    value: string
    unit: null
    scope: string
    modules: Array<never>
    sourceKind: string
    validFrom: null
    validTo: null
    evidence: Array<never>
    proposedBy: string
    installationId: null
    autoApply: boolean
}

/** Shared, complete test data for the capability cases. */
export const splitProposal: SplitProposalShape = {
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

/** The values of an inserted proposal, as a spec reads them back. */
interface InsertedValues {
    /** The workspace. */
    readonly workspaceId: string
    /** The subject type. */
    readonly subjectType: string
    /** The subject key. */
    readonly subjectKey: string
    /** The subject label. */
    readonly subjectLabel: string
    /** The attribute. */
    readonly attribute: string
    /** The attribute label. */
    readonly attributeLabel: string
    /** The value. */
    readonly value: string
    /** The numeric value as text. */
    readonly valueNumber: string | null
    /** The unit. */
    readonly unit: string | null
    /** The scope. */
    readonly scope: string
    /** The modules. */
    readonly modules: Array<string>
    /** The source kind. */
    readonly sourceKind: string
    /** The trust. */
    readonly trust: number
    /** The fact it disagrees with. */
    readonly conflictWith: string | null
    /** Who proposed it. */
    readonly proposedBy: string
    /** The installation. */
    readonly installationId: string | null
    /** The proposal kind. */
    readonly proposalKind: string
    /** The status. */
    readonly status: string
    /** The start instant, named as a function. */
    readonly validFrom: string
    /** The end instant, named as a function. */
    readonly validTo: string
    /** The evidence, named as a function. */
    readonly evidence: string
}

/** The parameters that carry an insert's instants and evidence. */
interface InsertParameters {
    /** The start instant text. */
    readonly validFrom: string | null
    /** The end instant text. */
    readonly validTo: string | null
    /** The evidence JSON. */
    readonly evidence: string
}

type InsertedOfShape = {
    readonly workspaceId?: string
    readonly subjectType?: string
    readonly subjectKey?: string
    readonly subjectLabel?: string
    readonly attribute?: string
    readonly attributeLabel?: string
    readonly value?: string
    readonly valueNumber?: string | null
    readonly unit?: string | null
    readonly scope?: string
    readonly modules?: Array<string>
    readonly sourceKind?: string
    readonly trust?: number
    readonly conflictWith?: string | null
    readonly proposedBy?: string
    readonly installationId?: string | null
    readonly proposalKind?: string
    readonly status?: string
    readonly validFrom?: string
    readonly validTo?: string
    readonly evidence?: string
}

/** The values a new proposal is inserted with; the three instants and the evidence are named as functions, their text is a parameter. */
export const insertedOf: (changes?: InsertedOfShape) => InsertedValues = entityRowBuilder<InsertedValues>({
    workspaceId: WS,
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8h",
    valueNumber: "8",
    unit: null,
    scope: "internal",
    modules: [],
    sourceKind: "staff",
    trust: 60,
    conflictWith: null,
    proposedBy: "u1",
    installationId: null,
    proposalKind: "set",
    status: "proposed",
    validFrom: "function",
    validTo: "function",
    evidence: "function",
})

type InsertParametersOfShape = {
    readonly validFrom?: string | null
    readonly validTo?: string | null
    readonly evidence?: string
}

/** The parameters that carry the instants and the evidence of an insert. */
export const insertParametersOf: (changes?: InsertParametersOfShape) => InsertParameters =
    entityRowBuilder<InsertParameters>({ validFrom: null, validTo: null, evidence: "[]" })

/** The retirement the document filing writes for an active value. */
export const retirementInsert: InsertedValues = insertedOf({
    modules: ["sales"],
    sourceKind: "document",
    trust: 75,
    conflictWith: "f1",
    proposedBy: "u2",
    installationId: "i1",
    proposalKind: "retire",
})

/** The values of a proposal written with every field explicit. */
export const explicitInsert: InsertedValues = insertedOf({
    subjectType: "product",
    unit: "hours",
    scope: "restricted",
    modules: ["chatbot"],
    installationId: "i1",
})

/** The values of a retirement filed for an orphan. */
export const orphanInsert: InsertedValues = insertedOf({
    sourceKind: "document",
    trust: 75,
    conflictWith: "file",
    proposedBy: "NIVO",
    proposalKind: "retire",
})

/** The values of a conflicting proposal that inherits the active value. */
export const conflictInsert: InsertedValues = insertedOf({
    subjectType: "service",
    unit: "hour",
    scope: "restricted",
    modules: ["sales"],
    conflictWith: "old",
})

/** The values of a restricted proposal with no modules. */
export const restrictedInsert: InsertedValues = insertedOf({ scope: "restricted" })

type ExplicitInputShape = {
    subjectType: "product"
    scope: "restricted"
    modules: Array<string>
    unit: string
    validFrom: string
    validTo: string
    evidence: Array<Evidence>
    installationId: string
    autoApply: true
}

/** The input that sets every field of a proposal. */
export const explicitInput: ExplicitInputShape = {
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

/** The active restricted value inherited by a conflicting proposal. */
export const conflictingActive: BrainFactEntity = rowOf({
    id: "old",
    value: "9h",
    subjectType: "service",
    scope: "restricted",
    modules: ["sales"],
    unit: "hour",
})
