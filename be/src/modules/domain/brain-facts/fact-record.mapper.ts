import type {
    BrainSubjectType,
    Evidence,
    FactRecord,
    FactSource,
    FactStatus,
    Instant,
    ProposalKind,
    Scope,
} from "./brain-facts.contracts"

/** A stored fact as the mapper reads it: a fact entity satisfies it, and the optional collections and instants may arrive as the driver gave them. */
export interface StoredFact {
    /** The id. */
    readonly id: string
    /** The subject type. */
    readonly subjectType: BrainSubjectType
    /** The subject key. */
    readonly subjectKey: string
    /** The subject label. */
    readonly subjectLabel: string
    /** The attribute key. */
    readonly attribute: string
    /** The attribute label. */
    readonly attributeLabel: string
    /** The value as text. */
    readonly value: string
    /** The value as a number, as text or number. */
    readonly valueNumber: string | number | null
    /** The unit. */
    readonly unit: string | null
    /** The scope. */
    readonly scope: Scope
    /** The modules of a restricted fact; null reads as none. */
    readonly modules: ReadonlyArray<string> | null
    /** The installation, or null. */
    readonly installationId: string | null
    /** The status. */
    readonly status: FactStatus
    /** The source kind. */
    readonly sourceKind: FactSource
    /** The trust. */
    readonly trust: number
    /** When it starts to hold. */
    readonly validFrom: Instant | null
    /** When it stops holding. */
    readonly validTo: Instant | null
    /** The fact it replaces. */
    readonly supersedesId: string | null
    /** The fact it disagrees with. */
    readonly conflictWith: string | null
    /** The proposal kind; null reads as a set. */
    readonly proposalKind: ProposalKind | null
    /** The evidence; null reads as none. */
    readonly evidence: ReadonlyArray<Evidence> | null
    /** Who proposed it. */
    readonly proposedBy: string
    /** When it was proposed. */
    readonly proposedAt: Instant
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was decided. */
    readonly decidedAt: Instant | null
    /** The decision note. */
    readonly decisionNote: string | null
}

/** An instant as ISO text, whether the driver gave a Date or text. */
export const isoOf = (value: Instant): string => (value instanceof Date ? value.toISOString() : value)

/** An optional instant as ISO text. */
const maybeIso = (value: Instant | null): string | null => (value === null ? null : isoOf(value))

/** A fact as the callers read it, from the row the database answers. */
export const toFactRecord = (row: StoredFact): FactRecord => ({
    id: row.id,
    subjectType: row.subjectType,
    subjectKey: row.subjectKey,
    subjectLabel: row.subjectLabel,
    attribute: row.attribute,
    attributeLabel: row.attributeLabel,
    value: row.value,
    valueNumber: row.valueNumber === null ? null : Number(row.valueNumber),
    unit: row.unit,
    scope: row.scope,
    modules: [...(row.modules ?? [])],
    installationId: row.installationId,
    status: row.status,
    sourceKind: row.sourceKind,
    trust: row.trust,
    validFrom: maybeIso(row.validFrom),
    validTo: maybeIso(row.validTo),
    supersedesId: row.supersedesId,
    conflictWith: row.conflictWith,
    proposalKind: row.proposalKind ?? "set",
    evidence: [...(row.evidence ?? [])],
    proposedBy: row.proposedBy,
    proposedAt: isoOf(row.proposedAt),
    decidedBy: row.decidedBy,
    decidedAt: maybeIso(row.decidedAt),
    decisionNote: row.decisionNote,
})
