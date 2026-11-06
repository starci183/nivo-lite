import type { DecisionRowView } from "../views/views.types"

/** The lines of a decision row under its copy, with none that repeats a line the row already shows. */
export interface DecisionLines {
    /** Why the agent stopped; null when it repeats the copy or says nothing. */
    readonly reason: string | null
    /** The words proposed; null when they repeat a line above. */
    readonly proposal: string | null
    /** The line of the trace; null when it repeats a line above or the row has no trace. */
    readonly trace: string | null
}

/** The line itself when it says something new; null when it is empty or equal to one already shown. */
const fresh = (line: string | null, shown: ReadonlyArray<string>): string | null => {
    const trimmed = line?.trim() ?? ""
    return trimmed === "" || shown.includes(trimmed) ? null : trimmed
}

/** The reason, the proposal and the trace of a row, in that order, each only when it adds something to the lines before it. */
export const decisionLinesOf = (row: DecisionRowView): DecisionLines => {
    const shown = [row.title.trim(), row.description.trim()]
    const reason = fresh(row.reason, shown)
    const proposal = fresh(row.proposal, reason === null ? shown : [...shown, reason])
    const seen = [...shown, ...[reason, proposal].filter((line) => line !== null)]
    return { reason, proposal, trace: fresh(row.trace?.line ?? null, seen) }
}
