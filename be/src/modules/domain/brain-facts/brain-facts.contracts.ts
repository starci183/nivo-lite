/** What a fact is about. */
export type BrainSubjectType =
    "business" | "product" | "service" | "policy" | "customer" | "person" | "supplier" | "place" | "other"

/** The subject types a fact may have. */
export const SUBJECT_TYPES: ReadonlyArray<BrainSubjectType> = [
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

/** Who may read a fact: public = customers too, internal = staff and internal agents, restricted = the modules it names. */
export type Scope = "public" | "internal" | "restricted"

/** Where a fact stands. */
export type FactStatus = "proposed" | "scheduled" | "active" | "superseded" | "rejected" | "expired"

/** Who a fact came from. */
export type FactSource = "owner" | "manager" | "document" | "system" | "staff" | "customer" | "ai"

/** A value (set) or a proposal to stop using an active fact (retire). */
export type ProposalKind = "set" | "retire"

/** Who the answer is for; `customer` only ever sees public facts. */
export type FactAudience = "customer" | "internal"

/** Where a piece of evidence came from; `ref` is the row id in its own table (or an address for a document). */
export interface Evidence {
    /** The kind of evidence. */
    readonly kind: "message" | "data_record" | "knowledge" | "decision" | "note" | "manual" | "document"
    /** The row or address it points at. */
    readonly ref: string
    /** A short label for people. */
    readonly label: string
    /** A verbatim excerpt. */
    readonly quote?: string
    /** When it happened. */
    readonly at?: string
    /** The connection it came from. */
    readonly connectionId?: string
    /** Document evidence: the source it was read from. */
    readonly sourceId?: string
    /** Document evidence: the title of the source. */
    readonly title?: string
}

/** One fact of the brain of a workspace. */
export interface FactRecord {
    /** The fact id. */
    readonly id: string
    /** What it is about. */
    readonly subjectType: BrainSubjectType
    /** The normalised subject. */
    readonly subjectKey: string
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The attribute as people write it. */
    readonly attributeLabel: string
    /** The value as written. */
    readonly value: string
    /** The value as a number when it is one. */
    readonly valueNumber: number | null
    /** The unit, when written apart from the value. */
    readonly unit: string | null
    /** Who may read it. */
    readonly scope: Scope
    /** The modules that may read a restricted fact. */
    readonly modules: ReadonlyArray<string>
    /** The one agent instance that reads it; null = every instance. */
    readonly installationId: string | null
    /** Where it stands. */
    readonly status: FactStatus
    /** Who it came from. */
    readonly sourceKind: FactSource
    /** How far the source is believed, 0 to 100. */
    readonly trust: number
    /** From when it holds. */
    readonly validFrom: string | null
    /** Until when it holds. */
    readonly validTo: string | null
    /** The fact this one replaced. */
    readonly supersedesId: string | null
    /** The active fact a proposal disagrees with, or the one a retire proposal points at. */
    readonly conflictWith: string | null
    /** A value or a proposal to stop using one. */
    readonly proposalKind: ProposalKind
    /** What supports it. */
    readonly evidence: ReadonlyArray<Evidence>
    /** Who proposed it. */
    readonly proposedBy: string
    /** When it was proposed. */
    readonly proposedAt: string
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was decided. */
    readonly decidedAt: string | null
    /** The reason given with the decision. */
    readonly decisionNote: string | null
}

/** A fact, or null when there is none. */
export type MaybeFact = FactRecord | null

/** The agent instance a fact is kept for, or null for every instance. */
export type InstallationScope = string | null

/** What a source says. */
export interface FactInput {
    /** What the fact is about; a known fact keeps its type. */
    readonly subjectType?: BrainSubjectType
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** The attribute as people write it. */
    readonly attributeLabel: string
    /** The value as written. */
    readonly value: string
    /** The unit. */
    readonly unit?: string | null
    /** Who may read it; a known fact keeps its scope. */
    readonly scope?: Scope
    /** The modules that may read a restricted fact. */
    readonly modules?: ReadonlyArray<string>
    /** Who it came from. */
    readonly sourceKind: FactSource
    /** From when it holds. */
    readonly validFrom?: string | null
    /** Until when it holds. */
    readonly validTo?: string | null
    /** What supports it. */
    readonly evidence?: ReadonlyArray<Evidence>
    /** Who proposed it. */
    readonly proposedBy: string
    /** Restricts the fact to one agent instance; omitted or null = every instance. */
    readonly installationId?: string | null
    /** Forces the review path (false) or the direct path (true); by default only a trusted source applies directly. */
    readonly autoApply?: boolean
}

/** What recording a fact did. */
export type BrainProposeOutcome = "applied" | "proposed" | "conflict" | "reinforced"

/** A fact and what recording it did. */
export interface ProposeResult {
    /** The fact as stored. */
    readonly fact: FactRecord
    /** What happened to it. */
    readonly outcome: BrainProposeOutcome
}

/** Which facts a list returns. */
export interface FactFilter {
    /** Only these statuses. */
    readonly statuses?: ReadonlyArray<FactStatus>
    /** Only this subject. */
    readonly subjectKey?: string
    /** At most this many, newest first. */
    readonly limit?: number
}

/** The facts of a time-based move: those that took over and those that expired. */
export interface MaintenanceResult {
    /** Scheduled facts that became active. */
    readonly activated: ReadonlyArray<FactRecord>
    /** How many ended facts expired. */
    readonly expired: number
}

/** An instant as a database driver answers it: a Date, or already text. */
export type Instant = Date | string
