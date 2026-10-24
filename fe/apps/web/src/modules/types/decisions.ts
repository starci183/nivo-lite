/** Who made a decision: the policy alone, or the owner or a staff member. */
export type DeciderKind = "policy" | "owner" | "staff"

/** What a decision came out as. */
export type DecisionOutcome = "auto_done" | "approved" | "edited" | "rejected" | "expired" | "completed"

/** The decision history filter by decider or rejected outcome. */
export type DecisionKind = "policy" | "human" | "rejected"

/** Why the gate asked a person; absent for routine work. */
export type GateReason = "routine" | "missing_data" | "over_authority" | "unclear_outcome" | "not_allowed"

/** One line of the decision history as the screens use it. */
export interface DecisionRecord {
    readonly id: string
    readonly work_item_id: string | null
    readonly lead_id: string | null
    /** The customer the decision was about, when there is one. */
    readonly leadName: string | null
    /** The module whose agent did the work. */
    readonly department: string
    readonly action: string
    readonly decided_by: string
    readonly decider_kind: DeciderKind
    readonly outcome: DecisionOutcome
    readonly reason: GateReason | null
    readonly note: string | null
    readonly created_at: string
}

/** What the history is filtered by. */
export interface DecisionFilter {
    readonly kind: DecisionKind | null
    readonly department: string | null
    readonly limit: number
}
