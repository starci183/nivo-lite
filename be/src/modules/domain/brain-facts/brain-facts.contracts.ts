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
export type FactProposalKind = "set" | "retire"

/**
 * What the brain noticed about a proposal that the founder must see before deciding it; a flagged proposal is never applied in bulk or
 * without a person.
 * - `stale`: its stated end has already passed when it was filed (a document says "valid until 30/06" in November). Approving it records
 *   it as history: it never comes in force.
 * - `same_meaning`: the model judged it the SAME fact as another one written in other words (another subject or attribute label);
 *   `conflictWith` names that fact. Approving it MERGES: it takes the other fact's place (the other value in force is superseded, or the
 *   other waiting proposal is rejected); "split" keeps both apart; reject drops it.
 */
export type FactFlag = "stale" | "same_meaning"

/** The flags a proposal may carry, in the order the store checks them. */
export const FACT_FLAGS: ReadonlyArray<FactFlag> = ["stale", "same_meaning"]

/** Who the answer is for; `customer` only ever sees public facts. */
export type FactAudience = "customer" | "internal"

/** What taking a document's contribution back did. */
export interface WithdrawnFacts {
    /** The active document facts left with no evidence. */
    readonly orphans: ReadonlyArray<string>
    /** How many facts lost this document. */
    readonly withdrawn: number
}

/** One piece of evidence a fact rests on. */
export interface Evidence {
    /** The kind of evidence. */
    readonly kind: "message" | "data_record" | "knowledge" | "decision" | "note" | "manual" | "document"
    /** The row or address it points at. */
    readonly ref: string
    /** A short label for people. */
    readonly label: string
    /** A verbatim excerpt. */
    readonly quote?: string | undefined
    /** When it happened. */
    readonly at?: string
    /** The connection it came from. */
    readonly connectionId?: string
    /** Document evidence: the source it was read from. */
    readonly sourceId?: string
    /** Document evidence: the title of the source. */
    readonly title?: string
    /**
     * Document evidence: the hash of the passage (chunk) the fact was read from, `passageTextHashOf` of its text. A change of the
     * document touches only the facts whose chunk hash is no longer among its passages.
     */
    readonly chunkHash?: string
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
    /**
     * The fact a proposal disagrees with: the value in force of its key, else (no value in force) the other value waiting for the same
     * key, else (flag `same_meaning`) the fact of another key it says the same thing as; for a retire proposal, the fact it would stop.
     */
    readonly conflictWith: string | null
    /** A value or a proposal to stop using one. */
    readonly proposalKind: FactProposalKind
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
    /**
     * Which value of its key this is: 1 on the first activation, one more on each value that replaces it. Absent on a proposal that was
     * never in force (and on a row the version backfill did not reach).
     */
    readonly version?: number
    /** What the brain noticed for the founder (`FactFlag`); absent when nothing. */
    readonly flags?: ReadonlyArray<FactFlag>
}

/** What decides who may read a fact: its scope, the modules it is restricted to and the instance it is kept for. */
export interface FactReach {
    /** Who may read it. */
    readonly scope: Scope
    /** The modules that may read a restricted fact. */
    readonly modules: ReadonlyArray<string>
    /** The one agent instance that reads it; null = every instance. */
    readonly installationId: string | null
}

/** The window in which a fact holds. */
export interface FactWindow {
    /** From when it holds. */
    readonly validFrom: string | null
    /** Until when it holds. */
    readonly validTo: string | null
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
    readonly scope?: Scope | undefined
    /** The modules that may read a restricted fact. */
    readonly modules?: ReadonlyArray<string>
    /** Who it came from. */
    readonly sourceKind: FactSource
    /** From when it holds. */
    readonly validFrom?: string | null | undefined
    /** Until when it holds. */
    readonly validTo?: string | null | undefined
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
    /** True when a new row was stored (never when an existing fact or proposal only grew its evidence); absent reads as false. */
    readonly created?: boolean
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

/**
 * How two facts of the truth graph relate, read from the first to the second: `part_of` (a detail of a broader truth), `applies_to`
 * (a rule or price that applies to it), `depends_on` (holds only when the other holds), `exception_of` (a narrower case that overrides
 * it), `related` (anything else worth following).
 */
export type RelationKind = "part_of" | "applies_to" | "depends_on" | "exception_of" | "related"

/** The relation kinds, in the order the store checks them. */
export const RELATION_KINDS: ReadonlyArray<RelationKind> = [
    "part_of",
    "applies_to",
    "depends_on",
    "exception_of",
    "related",
]

/** One edge of the truth graph. */
export interface FactRelation {
    /** The relation id. */
    readonly id: string
    /** The fact it starts from. */
    readonly fromFactId: string
    /** The fact it points at. */
    readonly toFactId: string
    /** How they relate. */
    readonly kind: RelationKind
    /** The relation in people's words ("giao bang"), or null. */
    readonly label: string | null
    /** Who made it: a person's name, or NIVO for the reading. */
    readonly createdBy: string
    /** When it was made. */
    readonly createdAt: string
}

/** An edge to add. */
export interface RelationInput {
    /** The fact it starts from. */
    readonly fromFactId: string
    /** The fact it points at. */
    readonly toFactId: string
    /** How they relate. */
    readonly kind: RelationKind
    /** The relation in people's words, or null. */
    readonly label?: string | null | undefined
    /** Who makes it. */
    readonly createdBy: string
}

/** A change to the truth that someone said in a chat, as an agent relays it. */
export interface ChangeRequest {
    /** The subject as people write it. */
    readonly subjectLabel: string
    /** The attribute as people write it. */
    readonly attributeLabel: string
    /** The new value; null asks to stop using the value in force. */
    readonly value: string | null
    /** The unit, when written apart from the value. */
    readonly unit?: string | null | undefined
    /** The chat the words were said in: an agent's private chat (`direct`) or the common chat. */
    readonly room: "direct" | "common"
    /** The chat message the words are in. */
    readonly messageId: string
    /** The words, verbatim. */
    readonly quote: string
    /** From when the new value holds, when said. */
    readonly validFrom?: string | null | undefined
    /** Until when the new value holds, when said ("this week"); else the one-year default applies on approval. */
    readonly validTo?: string | null | undefined
    /** Who relays it: the module of the agent. */
    readonly proposedBy: string
    /** The agent that relays it. */
    readonly agentId: string
    /** The agent instance the change is kept for; null = every instance. */
    readonly installationId: string | null
}

/** What filing a change request did: the proposal waiting for the founder, or the value is already the one in force. */
export interface ChangeFiled {
    /** `filed`: a proposal waits; `already_true`: the value in force says it already; `already_filed`: the same proposal waits. */
    readonly outcome: "filed" | "already_true" | "already_filed"
    /** The proposal, or the fact in force for `already_true`. */
    readonly fact: FactRecord
}
