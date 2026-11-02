import type { EntityManager } from "typeorm"

/** The verdict committed by the work owner. */
export type GraphWorkOutcome = "approved" | "rejected"

/** The actual human verdict a graph approval forwards to the work owner. */
export interface GraphWorkResume {
    /** The workspace whose item was approved. */
    readonly workspaceId: string
    /** The durable work item. */
    readonly workItemId: string
    /** The verdict of the requested seat. */
    readonly outcome: GraphWorkOutcome
    /** The authenticated seat, never its display name. */
    readonly memberId: string | null
}

/** The work owner's verdict under its row lock; a busy item is refused by that owner. */
export type GraphWorkClaim = { readonly kind: "open" } | { readonly kind: "closed"; readonly outcome: GraphWorkOutcome }

/** Resumes and locks the work owner without making the graph depend on its engine implementation. */
export interface GraphWorkDecisions {
    /** False when a competing decision already moved the item out of its waiting state. */
    resume(request: GraphWorkResume): Promise<boolean>
    /** Claims the item against a human reopen, refusing queued or in-flight work. */
    claim(manager: EntityManager, workspaceId: string, workItemId: string): Promise<GraphWorkClaim>
    /** Requires a committed owner verdict after a competing resume. */
    closedOutcome(manager: EntityManager, workspaceId: string, workItemId: string): Promise<GraphWorkOutcome>
    /** Applies the published stop policy in the caller's transaction, refusing a lost decision. */
    reject(manager: EntityManager, workspaceId: string, workItemId: string): Promise<void>
}
