"use client"

import { EMPTY_LOYALTY_BOARD, daysSince, findTier, tierTone } from "@/hooks/loyalty"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import { MEMBER_SORTS, groupPhone, lastVisitOf, useMemberDetailView, useMemberList } from "@/hooks/loyaltyMembers"
import { LoyaltyMembersBase } from "./component"

const DETAIL_ID = "loyalty-member-detail"

/** The connected member list: search, tier filter, sort and show-more; a picked member opens the detail beside it. */
/** The connected Members tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const LoyaltyMembers = () => {
    const read = useQueryLoyaltyBoardSwr()
    const board = read.data ?? EMPTY_LOYALTY_BOARD
    const slotLabels = useSlotLabels()
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const list = useMemberList(board)
    const detail = useMemberDetailView(board, list.selected)
    const { selected } = list
    useEffect(() => {
        if (selected !== null)
            document.getElementById(DETAIL_ID)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }, [selected])
    const money = (value: number) =>
        format.number(value, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const visit = (iso: string | null | undefined) => {
        const last = lastVisitOf(iso, board.nowIso, daysSince)
        return t(last.key, { n: last.n })
    }
    const isEmpty = list.rows.length === 0
    // Built from the empty board while the read is on its way, so the placeholder is the same tree.
    const view = buildLoyaltyMembersView({ t, list, board, format, visit, money, isEmpty, detail })
    return (
        <LoyaltyMembersBase
            props={{
                slot: mapSlot(slotOfSwr(read), () => view),
                placeholder: view,
                slotLabels: slotLabels(t("emptyMembersTitle")),
            }}
            on={{
                search: list.setQuery,
                setTier: list.setTier,
                setSort: list.setSort,
                select: (id) => {
                    detail.clear()
                    list.select(id)
                },
                showMore: list.showMore,
                retry: () => void read.mutate(),
            }}
        />
    )
}

/** Inputs needed to build the LoyaltyMembersContent section. */
interface BuildLoyaltyMembersViewContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly list: ReturnType<typeof useMemberList>
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly format: ReturnType<typeof useFormatter>
    readonly visit: (iso: string | null | undefined) => string
    readonly money: (value: number) => string
    readonly isEmpty: boolean
    readonly detail: ReturnType<typeof useMemberDetailView>
}
/** Builds the LoyaltyMembersContent section from the current view. */
const buildLoyaltyMembersView = ({
    t,
    list,
    board,
    format,
    visit,
    money,
    isEmpty,
    detail,
}: BuildLoyaltyMembersViewContext) =>
    ({
        title: t("membersTitle"),
        countLabel: t("membersCount", { n: list.rows.length }),
        search: { label: t("searchLabel"), placeholder: t("searchPlaceholder"), value: list.query },
        tier: {
            label: t("filterTier"),
            value: list.tier,
            options: [
                { id: "all", label: t("filterAllTiers") },
                ...board.config.tiers.map((tier) => ({ id: tier.key, label: tier.name })),
            ],
        },
        sort: {
            label: t("sortLabel"),
            value: list.sort,
            options: MEMBER_SORTS.map((key) => ({ id: key, label: t(`sort_${key}`) })),
        },
        rows: list.shown.map((member) => {
            const tier = findTier(board.config, member.tierKey ?? null)
            return {
                id: member.id,
                label: member.name,
                description: [
                    groupPhone(member.phone) || t("noPhone"),
                    t("points", { n: format.number(member.points) }),
                    visit(member.lastVisitAt),
                    t("spentTotal", { value: money(member.lifetimeSpendVnd) }),
                ].join(" · "),
                ...(tier === null
                    ? {}
                    : { tier: { name: tier.name, tone: tierTone(board.config, member.tierKey ?? null) } }),
            }
        }),
        ...(isEmpty
            ? {
                  empty: {
                      title: board.members.length === 0 ? t("emptyMembersTitle") : t("noMatch"),
                      body: board.members.length === 0 ? t("emptyMembersBodyStaff") : t("noMatchBody"),
                  },
              }
            : {}),
        selectedId: list.selected,
        ...(list.remaining > 0 ? { showMoreLabel: t("showMore", { n: list.remaining }) } : {}),
        detailId: DETAIL_ID,
        panel: {
            ...("loading" in detail ? { loading: detail.loading } : {}),
            ...("failed" in detail ? { failed: detail.failed } : {}),
            ...("view" in detail ? { view: detail.view } : {}),
        },
        detailEmpty: { title: t("detailEmptyTitle"), body: t("detailEmptyBody") },
    }) as const
