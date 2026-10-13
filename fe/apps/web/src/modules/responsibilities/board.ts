import type { DueKey, ResponsibilityRowView, RowStatus } from "./rows"

/** The value of the "every owner" choice. */
export const ALL_OWNERS = "all"

/** Does the row fall in the due filter? */
const matchesDue = (row: ResponsibilityRowView, due: DueKey): boolean => {
    if (due === "overdue") return row.isOverdue
    if (due === "today") return row.isDueToday
    if (due === "week") return row.isDueThisWeek
    if (due === "none") return row.dueAt === null && row.status !== "done"
    return true
}

const byDue = (a: ResponsibilityRowView, b: ResponsibilityRowView): number => {
    if (a.dueAt === b.dueAt) return 0
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    return a.dueAt.localeCompare(b.dueAt)
}

const byNewest = (a: ResponsibilityRowView, b: ResponsibilityRowView): number => b.createdAt.localeCompare(a.createdAt)

/** The order rows are listed in. */
export type SortKey = "due" | "newest"

/** What the board narrows the rows by. */
export interface BoardFilters {
    readonly status: RowStatus | "all"
    readonly due: DueKey
    readonly owner: string
    readonly query: string
    readonly sort: SortKey
}

/** The rows a filter set lets through, and how many each status holds within the owner, due and search filters. */
export const narrowRows = (
    rows: ReadonlyArray<ResponsibilityRowView>,
    filters: BoardFilters,
    allOwners: string,
): {
    readonly visible: ReadonlyArray<ResponsibilityRowView>
    readonly counts: Readonly<Record<RowStatus | "all", number>>
} => {
    const q = filters.query.trim().toLowerCase()
    const scoped = rows.filter(
        (row) =>
            (filters.owner === allOwners || row.ownerKey === filters.owner) &&
            matchesDue(row, filters.due) &&
            (q === "" || `${row.title} ${row.customer} ${row.nextAction} ${row.ownerName}`.toLowerCase().includes(q)),
    )
    const counts = {
        all: scoped.length,
        open: scoped.filter((row) => row.status === "open").length,
        waiting_approval: scoped.filter((row) => row.status === "waiting_approval").length,
        done: scoped.filter((row) => row.status === "done").length,
    }
    const visible = scoped
        .filter((row) => filters.status === "all" || row.status === filters.status)
        .sort(filters.sort === "due" ? byDue : byNewest)
    return { visible, counts }
}
