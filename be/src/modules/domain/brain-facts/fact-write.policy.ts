import type { FactChanges } from "./fact-columns.policy"

/**
 * How long a truth holds when nobody said otherwise (owner, 2026-11-10: "every truth defaults to ONE YEAR unless a shorter period is
 * stated"), as SQL. A stated end is kept as it is.
 */
export const DEFAULT_VALIDITY: string = "interval '1 year'"

/** The end a fact takes on approval: the stated one, else one year after it starts to hold. */
export const DEFAULT_VALID_TO: string = `coalesce(valid_to, coalesce(valid_from, now()) + ${DEFAULT_VALIDITY})`

/** The version a fact takes when it replaces the value in force (or is the first one). */
export const nextVersion = (current: { readonly version?: number } | undefined): number => (current?.version ?? 0) + 1

/** The changes of a decision: the new status, the note and who decided, stamped now. */
export const decisionOf = (status: "rejected" | "expired", note: string | null, decidedBy?: string): FactChanges => ({
    status,
    ...(decidedBy === undefined ? {} : { decidedBy }),
    decidedAt: () => "now()",
    decisionNote: note,
})

/** The changes that approve a proposal as scheduled for later, replacing the value it will follow; it takes the default end. */
export const scheduleChanges = (currentId: string | null, decidedBy: string, reason: string | null): FactChanges => ({
    status: "scheduled",
    supersedesId: currentId,
    conflictWith: null,
    decidedBy,
    decidedAt: () => "now()",
    decisionNote: reason,
    validTo: () => DEFAULT_VALID_TO,
})

/**
 * The changes that approve a proposal as the value in force from now (or from its own start): it holds for one year unless its end
 * was stated, and it is the next version of its key.
 */
export const activateChanges = (
    currentId: string | null,
    decidedBy: string,
    reason: string | null,
    version: number,
): FactChanges => ({
    status: "active",
    supersedesId: currentId,
    conflictWith: null,
    decidedBy,
    decidedAt: () => "now()",
    decisionNote: reason,
    validFrom: () => "coalesce(valid_from, now())",
    validTo: () => DEFAULT_VALID_TO,
    version,
})

/**
 * The changes that close the value in force as history: it ends now, or earlier when its own end came first; never at or before its
 * start (the table's check), so a value replaced in the instant it began ends one millisecond after it.
 */
export const SUPERSEDE: FactChanges = {
    status: "superseded",
    validTo: () => "greatest(least(coalesce(valid_to, now()), now()), valid_from + interval '1 millisecond')",
}
