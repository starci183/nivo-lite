import type { FactChanges } from "./fact-columns.policy"

/** The changes of a decision: the new status, the note and who decided, stamped now. */
export const decisionOf = (status: "rejected" | "expired", note: string | null, decidedBy?: string): FactChanges => ({
    status,
    ...(decidedBy === undefined ? {} : { decidedBy }),
    decidedAt: () => "now()",
    decisionNote: note,
})

/** The changes that approve a proposal as scheduled for later, replacing the value it will follow. */
export const scheduleChanges = (currentId: string | null, decidedBy: string, reason: string | null): FactChanges => ({
    status: "scheduled",
    supersedesId: currentId,
    conflictWith: null,
    decidedBy,
    decidedAt: () => "now()",
    decisionNote: reason,
})

/** The changes that approve a proposal as the value in force from now (or from its own start). */
export const activateChanges = (currentId: string | null, decidedBy: string, reason: string | null): FactChanges => ({
    status: "active",
    supersedesId: currentId,
    conflictWith: null,
    decidedBy,
    decidedAt: () => "now()",
    decisionNote: reason,
    validFrom: () => "coalesce(valid_from, now())",
})

/** The changes that close the value in force as history. */
export const SUPERSEDE: FactChanges = {
    status: "superseded",
    validTo: () => "coalesce(valid_to, now())",
}
