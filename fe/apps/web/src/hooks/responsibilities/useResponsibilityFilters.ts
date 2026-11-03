"use client"

import { useMemo, useState } from "react"
import { ALL_OWNERS, groupRowsByOwner, narrowRows } from "@/modules/responsibilities"
import type { DueKey, OwnerGroupView, ResponsibilityRowView, RowStatus, SortKey } from "@/modules/responsibilities"
import type { SetStateAction, Dispatch } from "react"

/** The filters a link can preselect. */
export interface InitialFilters {
    readonly status: RowStatus | "all"
    readonly due: DueKey
}

/** The owners that hold rows, as filter choices (without the "every owner" one). */
const ownersOf = (rows: ReadonlyArray<ResponsibilityRowView>): ReadonlyArray<{ id: string; name: string }> => {
    const seen = new Map<string, string>()
    for (const row of rows) seen.set(row.ownerKey, row.ownerName)
    return [...seen].map(([id, name]) => ({ id, name }))
}

type UseResponsibilityFiltersResult = {
    status: "open" | "waiting_approval" | "done" | "all"
    due: "any" | "overdue" | "today" | "week" | "none"
    owner: string
    query: string
    sort: SortKey
    showFilters: boolean
    owners: readonly {
        id: string
        name: string
    }[]
    counts: Readonly<Record<RowStatus | "all", number>>
    visibleCount: number
    groups: readonly OwnerGroupView[]
    isFiltered: boolean
    setStatus: Dispatch<SetStateAction<"open" | "waiting_approval" | "done" | "all">>
    setDue: Dispatch<SetStateAction<"any" | "overdue" | "today" | "week" | "none">>
    setOwner: Dispatch<SetStateAction<string>>
    setQuery: Dispatch<SetStateAction<string>>
    setSort: Dispatch<SetStateAction<SortKey>>
    toggleFilters: () => void
    clear: () => void
}

/** The board's filters, search and sort over the rows, and what they let through. */
export const useResponsibilityFilters = (
    rows: ReadonlyArray<ResponsibilityRowView>,
    initial: InitialFilters,
): UseResponsibilityFiltersResult => {
    const [status, setStatus] = useState(initial.status)
    const [due, setDue] = useState(initial.due)
    const [owner, setOwner] = useState(ALL_OWNERS)
    const [query, setQuery] = useState("")
    const [sort, setSort] = useState<SortKey>("due")
    const [showFilters, setShowFilters] = useState(false)
    const owners = useMemo(() => ownersOf(rows), [rows])
    const narrowed = useMemo(
        () => narrowRows(rows, { status, due, owner, query, sort }, ALL_OWNERS),
        [rows, status, due, owner, query, sort],
    )
    const groups: ReadonlyArray<OwnerGroupView> = useMemo(() => groupRowsByOwner(narrowed.visible), [narrowed.visible])
    const isFiltered = status !== "all" || due !== "any" || owner !== ALL_OWNERS || query.trim() !== ""
    const clear = (): void => {
        setStatus("all")
        setDue("any")
        setOwner(ALL_OWNERS)
        setQuery("")
    }
    return {
        status,
        due,
        owner,
        query,
        sort,
        showFilters,
        owners,
        counts: narrowed.counts,
        visibleCount: narrowed.visible.length,
        groups,
        isFiltered,
        setStatus,
        setDue,
        setOwner,
        setQuery,
        setSort,
        toggleFilters: (): void => setShowFilters((open) => !open),
        clear,
    }
}
