import type { BrainSubjectType, Evidence, FactSource, FactStatus, ProposalKind, Scope } from "../brain-facts.contracts"

/** A nullable timestamp returned by the PostgreSQL driver. */
type NullableTimestamp = Date | string | null

/** One row of public.brain_facts; timestamps arrive as Date or text depending on the driver. */
export interface BrainFactRow {
    /** The fact id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The one agent instance that reads it, or null. */
    readonly installation_id: string | null
    /** What it is about. */
    readonly subject_type: BrainSubjectType
    /** The normalised subject. */
    readonly subject_key: string
    /** The subject as written. */
    readonly subject_label: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The attribute as written. */
    readonly attribute_label: string
    /** The value. */
    readonly value: string
    /** The numeric value, as the driver gives numerics. */
    readonly value_number: string | number | null
    /** The unit. */
    readonly unit: string | null
    /** public, internal or restricted. */
    readonly scope: Scope
    /** The modules allowed to read a restricted fact. */
    readonly modules: ReadonlyArray<string> | null
    /** Where it stands. */
    readonly status: FactStatus
    /** Who it came from. */
    readonly source_kind: FactSource
    /** The trust of the source. */
    readonly trust: number
    /** From when it holds. */
    readonly valid_from: NullableTimestamp
    /** Until when it holds. */
    readonly valid_to: NullableTimestamp
    /** The fact it replaced. */
    readonly supersedes_id: string | null
    /** The fact it disagrees with. */
    readonly conflict_with: string | null
    /** set or retire. */
    readonly proposal_kind: ProposalKind | null
    /** The evidence list. */
    readonly evidence: ReadonlyArray<Evidence> | null
    /** Who proposed it. */
    readonly proposed_by: string
    /** When it was proposed. */
    readonly proposed_at: Date | string
    /** Who decided. */
    readonly decided_by: string | null
    /** When it was decided. */
    readonly decided_at: NullableTimestamp
    /** The reason for the decision. */
    readonly decision_note: string | null
}

/** The id of a fact that was written. */
export interface FactIdRow {
    /** The fact id. */
    readonly id: string
}
