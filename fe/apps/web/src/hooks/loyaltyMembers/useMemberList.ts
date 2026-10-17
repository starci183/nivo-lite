"use client"

import type { LoyaltyBoardType } from "@/hooks/swr"
import { useMemo, useState } from "react"
import { MEMBER_PAGE_SIZE, MEMBER_SORTS, matchesQuery, sortValue } from "./loyaltyMembers.shared"
import type { MemberSortKey } from "./loyaltyMembers.shared"

/** The member list's search, tier filter, sort and paging, and the member picked for the detail. */
export const useMemberList = (board: LoyaltyBoardType) => {
    const [query, setQuery] = useState("")
    const [tier, setTier] = useState("all")
    const [sort, setSort] = useState<MemberSortKey>("lastVisit")
    const [limit, setLimit] = useState(MEMBER_PAGE_SIZE)
    const [selected, setSelected] = useState<string | null>(null)
    const rows = useMemo(
        () =>
            board.members
                .filter((member) => tier === "all" || member.tierKey === tier)
                .filter((member) => matchesQuery(member, query))
                .sort((a, b) => sortValue(b, sort) - sortValue(a, sort)),
        [board.members, query, tier, sort],
    )
    return {
        rows,
        shown: rows.slice(0, limit),
        remaining: Math.max(0, rows.length - limit),
        query,
        tier,
        sort,
        selected,
        setQuery: (value: string) => {
            setQuery(value)
            setLimit(MEMBER_PAGE_SIZE)
        },
        setTier: (value: string | null) => {
            setTier(value ?? "all")
            setLimit(MEMBER_PAGE_SIZE)
        },
        setSort: (value: string | null) => {
            setSort(MEMBER_SORTS.find((key) => key === value) ?? "lastVisit")
            setLimit(MEMBER_PAGE_SIZE)
        },
        showMore: () => setLimit((count) => count + MEMBER_PAGE_SIZE),
        select: (id: string | null) => setSelected(id),
    }
}
