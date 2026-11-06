/** What a decision came out as. */
export type DecisionOutcome = "auto_done" | "approved" | "edited" | "rejected" | "expired" | "completed"

/** The decision history filter by decider or rejected outcome. */
export type DecisionKind = "policy" | "human" | "rejected"

/** What the history is filtered by. */
export interface DecisionFilter {
    readonly kind: DecisionKind | null
    readonly department: string | null
    readonly limit: number
}
