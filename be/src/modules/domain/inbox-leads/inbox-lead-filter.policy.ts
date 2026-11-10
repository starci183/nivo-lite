import type { InboxCounts, InboxLeadRow, InboxSort, InboxTab } from "./inbox-leads.contracts"

const TABS = ["all", "new", "needs_you", "ordered", "paid"] as const satisfies ReadonlyArray<InboxTab>
const SORTS = ["recent", "oldest", "name", "amount"] as const satisfies ReadonlyArray<InboxSort>

/** The tab a word names; any other word is the first tab. */
export const tabOf = (word: string): InboxTab => TABS.find((tab) => tab === word) ?? "all"

/** The order a word names; any other word is the newest first. */
export const sortOf = (word: string): InboxSort => SORTS.find((sort) => sort === word) ?? "recent"

/** The words to search, trimmed; blank words search nothing. */
export const searchOf = (words: string | null): string | null => {
    const trimmed = words?.trim() ?? ""
    return trimmed === "" ? null : trimmed
}

/** Whether a row belongs under a tab: new customers, customers waiting on the owner, customers with an order, money that came in. */
export const inTab = (row: InboxLeadRow, tab: InboxTab): boolean => {
    if (tab === "all") return true
    if (tab === "new") return row.stage === "new"
    if (tab === "needs_you") return row.needsOwner
    if (tab === "ordered") {
        if (row.isUnmatched) return false
        return row.stage === "ordered" || row.stage === "paid" || (row.stage === "done" && row.amountVnd !== null)
    }
    return row.isUnmatched || row.stage === "paid" || (row.stage === "done" && row.amountVnd !== null)
}

/** How many rows each tab holds. */
export const countsOf = (rows: ReadonlyArray<InboxLeadRow>): InboxCounts => ({
    all: rows.length,
    new: rows.filter((row) => inTab(row, "new")).length,
    needsYou: rows.filter((row) => inTab(row, "needs_you")).length,
    ordered: rows.filter((row) => inTab(row, "ordered")).length,
    paid: rows.filter((row) => inTab(row, "paid")).length,
})

/** Narrows rows by channel and agent; a null filter keeps everything. */
export const narrowed = (
    rows: ReadonlyArray<InboxLeadRow>,
    channel: string | null,
    agentId: string | null,
): ReadonlyArray<InboxLeadRow> =>
    rows.filter((row) => (channel === null || row.channel === channel) && (agentId === null || row.agentId === agentId))

/** Whether a row's name or words contain every word of the search, ignoring case. */
export const matchesSearch = (row: InboxLeadRow, search: string | null): boolean => {
    if (search === null) return true
    const hay = `${row.name} ${row.summary}`.toLowerCase()
    return search
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word !== "")
        .every((word) => hay.includes(word))
}

const byRecent = (left: InboxLeadRow, right: InboxLeadRow): number => right.lastAt.localeCompare(left.lastAt)

/** The rows in the asked order; every order falls back to the newest first. */
export const sorted = (rows: ReadonlyArray<InboxLeadRow>, sort: InboxSort): ReadonlyArray<InboxLeadRow> => {
    const copy = [...rows]
    if (sort === "oldest") return copy.sort((left, right) => left.lastAt.localeCompare(right.lastAt))
    if (sort === "name") return copy.sort((left, right) => left.name.localeCompare(right.name) || byRecent(left, right))
    if (sort === "amount") {
        return copy.sort((left, right) => (right.amountVnd ?? -1) - (left.amountVnd ?? -1) || byRecent(left, right))
    }
    return copy.sort(byRecent)
}
