/** What a fact is about. */
export type FactSubjectType =
    "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"

/** Who may read a fact: everyone including customers, staff, or the modules it names. */
export type FactScope = "public" | "internal" | "restricted"

/** Where a fact stands. */
export type FactState = "proposed" | "scheduled" | "active" | "superseded" | "rejected" | "expired"

/** Who a fact came from. */
export type FactSource = "owner" | "manager" | "document" | "system" | "staff" | "customer" | "ai"

/** Who an agent answers: customers see public facts only. */
export type AgentAudience = "customer" | "internal"

/** The subject types, in the order the form offers them. */
export const FACT_SUBJECT_TYPES: ReadonlyArray<FactSubjectType> = [
    "business",
    "product",
    "service",
    "policy",
    "customer",
    "person",
    "supplier",
    "place",
    "other",
]

/** Where a piece of evidence came from. */
export interface BrainEvidence {
    readonly kind: string
    readonly ref: string
    readonly label: string
    readonly quote?: string
    readonly at?: string
}

/** One fact of the shared brain. */
export interface BrainFact {
    readonly id: string
    readonly subjectType: FactSubjectType
    readonly subjectKey: string
    readonly subjectLabel: string
    readonly attribute: string
    readonly attributeLabel: string
    readonly value: string
    readonly unit: string | null
    readonly scope: FactScope
    readonly modules: ReadonlyArray<string>
    readonly installationId: string | null
    readonly status: FactState
    readonly sourceKind: FactSource
    readonly trust: number
    readonly validFrom: string | null
    readonly validTo: string | null
    /** A value, or a proposal to stop using the active fact it points at. */
    readonly proposalKind: "set" | "retire"
    readonly evidence: ReadonlyArray<BrainEvidence>
    readonly proposedBy: string
    readonly proposedAt: string
    readonly decidedBy: string | null
    readonly decidedAt: string | null
}

/** How an agent should work, learnt from the owner. */
export interface BrainLesson {
    readonly id: string
    readonly module: string | null
    readonly title: string
    readonly body: string
    readonly appliesWhen: string
    readonly status: "proposed" | "active" | "retired" | "rejected"
    readonly evidence: ReadonlyArray<BrainEvidence>
}

/** A question customers asked that the brain could not answer. */
export interface BrainGap {
    readonly id: string
    readonly module: string
    readonly question: string
    readonly topic: string | null
    readonly attributeGuess: string | null
    readonly count: number
    readonly lastSeenAt: string
    readonly reopenedCount: number
}

/** Where the reading of one document stands. */
export interface BrainExtraction {
    readonly sourceId: string
    readonly status: "queued" | "running" | "done" | "failed" | "blocked_credits"
}

/** One agent the owner can look through: its module, name and audience. */
export interface BrainLens {
    readonly module: string
    readonly name: string
    readonly audience: AgentAudience
}
