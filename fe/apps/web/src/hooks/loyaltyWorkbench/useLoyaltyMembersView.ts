import type { LoyaltyPanelInput } from "@/hooks/loyalty"

import { daysSince, useLoyaltyPanelBoard } from "@/hooks/loyalty"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { lastVisitOf, useMemberDetailView, useMemberList } from "@/hooks/loyaltyMembers"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { LOYALTY_MEMBER_DETAIL_ID, buildLoyaltyMembersView } from "./loyaltyWorkbench.shared"

/** The member list section as the builder draws it, and the detail pane as its hook draws it. */
type MembersBuilt = ReturnType<typeof buildLoyaltyMembersView>
type MemberDetail = ReturnType<typeof useMemberDetailView>

/** The view `useLoyaltyMembersView` returns. */
export interface LoyaltyMembersViewShape {
    props: {
        slot: DataSlot<{ rows: MembersBuilt["rows"] }>
        copy: Omit<MembersBuilt, "rows">
        labels: SlotLabels
        detail: MemberDetail["props"]
    }
    on: {
        search: ReturnType<typeof useMemberList>["setQuery"]
        setTier: ReturnType<typeof useMemberList>["setTier"]
        setSort: ReturnType<typeof useMemberList>["setSort"]
        select: (id: string | null) => void
        showMore: () => void
        retry: () => void
        detail: MemberDetail["on"]
    }
}

/** The connected member list: search, tier filter, sort and show-more; a picked member opens the detail beside it. */
/** The connected Members tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const useLoyaltyMembersView = (input: LoyaltyPanelInput): LoyaltyMembersViewShape => {
    const { read, board, slotLabels, retry } = useLoyaltyPanelBoard(input)
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const list = useMemberList(board, input)
    const detail = useMemberDetailView(board, input.isActive ? list.selected : null, input)
    const { selected } = list
    useEffect(() => {
        if (input.isActive && selected !== null)
            document.getElementById(LOYALTY_MEMBER_DETAIL_ID)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }, [selected, input.isActive])
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const visit = (iso: string | null | undefined) => {
        const last = lastVisitOf(iso, board.nowIso, daysSince)
        return t(last.key, { n: last.n })
    }
    // Built from the empty board while the read is on its way, so the placeholder is the same tree.
    const view = buildLoyaltyMembersView({ t, list, board, format, visit, money })
    const { rows, ...copy } = view
    return {
        props: {
            slot: mapSlot(slotOfSwr(read), () => ({ rows })),
            copy,
            labels: slotLabels(t("emptyMembersTitle")),
            detail: detail.props,
        },
        on: {
            search: list.setQuery,
            setTier: list.setTier,
            setSort: list.setSort,
            select: (id: string | null) => {
                detail.clear()
                list.select(id)
            },
            showMore: list.showMore,
            retry: retry,
            detail: detail.on,
        },
    }
}
