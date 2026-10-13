import type { Evidence } from "@modules/domain/brain-facts"

/** One fact of the brain. */
export class FactResponse {
    /** The fact id. */
    id!: string
    /** What it is about. */
    subjectType!: string
    /** The normalised subject. */
    subjectKey!: string
    /** The subject as written. */
    subjectLabel!: string
    /** The normalised attribute. */
    attribute!: string
    /** The attribute as written. */
    attributeLabel!: string
    /** The value. */
    value!: string
    /** The value as a number, when it is one. */
    valueNumber!: number | null
    /** The unit. */
    unit!: string | null
    /** public, internal or restricted. */
    scope!: string
    /** The modules that may read a restricted fact. */
    modules!: ReadonlyArray<string>
    /** The one agent instance that reads it, or null. */
    installationId!: string | null
    /** Where it stands. */
    status!: string
    /** Who it came from. */
    sourceKind!: string
    /** The trust of the source. */
    trust!: number
    /** From when it holds. */
    validFrom!: string | null
    /** Until when it holds. */
    validTo!: string | null
    /** The fact it replaced. */
    supersedesId!: string | null
    /** The fact it disagrees with. */
    conflictWith!: string | null
    /** set or retire. */
    proposalKind!: string
    /** What supports it. */
    evidence!: ReadonlyArray<Evidence>
    /** Who proposed it. */
    proposedBy!: string
    /** When it was proposed. */
    proposedAt!: string
    /** Who decided it. */
    decidedBy!: string | null
    /** When it was decided. */
    decidedAt!: string | null
    /** The reason for the decision. */
    decisionNote!: string | null
}

/** What writing a fact did. */
export class SavedFactResponse {
    /** The fact as stored. */
    fact!: FactResponse
    /** applied, proposed, conflict or reinforced. */
    outcome!: string
}

/** How many waiting values were rejected. */
export class KeptResponse {
    /** The count. */
    rejected!: number
}
