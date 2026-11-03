"use client"

import type { LoyaltyBoardType } from "@/hooks/swr"
import type { LoyaltyPanelActivation } from "@/hooks/loyalty"
import { useMemo, useState } from "react"
import { useFeatureReset } from "@/hooks/reuseables"
import { MEMBER_PAGE_SIZE, MEMBER_SORTS, matchesQuery, sortValue } from "./loyaltyMembers.shared"
import type { MemberSortKey } from "./loyaltyMembers.shared"

/** The view `useMemberList` returns. */
export interface MemberListView {
    rows: {
        birthday: string | null
        email: string | null
        id: string
        joinedAt: string
        lastVisitAt: string | null
        lifetimeSpendVnd: number
        name: string
        note: string
        phone: string | null
        points: number
        tierKey: string | null
        visits: number
    }[]
    shown: {
        birthday: string | null
        email: string | null
        id: string
        joinedAt: string
        lastVisitAt: string | null
        lifetimeSpendVnd: number
        name: string
        note: string
        phone: string | null
        points: number
        tierKey: string | null
        visits: number
    }[]
    remaining: number
    query: string
    tier: string
    sort: MemberSortKey
    selected: string | null
    setQuery: (value: string) => void
    setTier: (value: string | null) => void
    setSort: (value: string | null) => void
    showMore: () => void
    select: (id: string | null) => void
}

/** The member list's search, tier filter, sort and paging, and the member picked for the detail. */
export const useMemberList = (board: LoyaltyBoardType, activation: LoyaltyPanelActivation): MemberListView => {
    const [sessionScope, setSessionScope] = useState<string | null>(null)
    const isCurrent = activation.isActive && activation.isReady && sessionScope === activation.scope
    const [queryState, setQuery] = useState("")
    const [tierState, setTier] = useState("all")
    const [sortState, setSort] = useState<MemberSortKey>("lastVisit")
    const [limitState, setLimit] = useState(MEMBER_PAGE_SIZE)
    const [selectedState, setSelected] = useState<string | null>(null)
    const query = isCurrent ? queryState : ""
    const tier = isCurrent ? tierState : "all"
    const sort = isCurrent ? sortState : "lastVisit"
    const limit = isCurrent ? limitState : MEMBER_PAGE_SIZE
    const selected = isCurrent ? selectedState : null
    useFeatureReset({
        ...activation,
        onReset: () => {
            setSessionScope(activation.isActive && activation.isReady ? activation.scope : null)
            setQuery("")
            setTier("all")
            setSort("lastVisit")
            setLimit(MEMBER_PAGE_SIZE)
            setSelected(null)
        },
    })
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
