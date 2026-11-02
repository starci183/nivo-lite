import type { WorkItem } from "./work-items.contracts"

/** A work item of a department that waits for the owner's decision. */
export interface WaitingDecision {
    /** The work item id. */
    readonly id: string
    /** The action it decides. */
    readonly action: string
    /** The proposal. */
    readonly proposal: Record<string, unknown>
    /** When it was asked. */
    readonly created_at: Date | string
}
/** The work owner's state under its decision row lock. */
export type WorkDecisionClaim =
    { readonly kind: "busy" } | { readonly kind: "open" } | { readonly kind: "closed"; readonly item: WorkItem }
