import type { LoyaltyPanelInput } from "@/hooks/loyalty"

import { EMPTY_LOYALTY_BOARD, daysSince, findTier, tierTone, useLoyaltyPanelBoard } from "@/hooks/loyalty"
import { mapSlot, slotOfSwr } from "@/hooks/slot"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect } from "react"
import {
    MEMBER_SORTS,
    groupPhone,
    lastVisitOf,
    useMemberDetailView,
    useMemberList,
    type MemberSortKey,
} from "@/hooks/loyaltyMembers"
import type { DataSlot, SlotLabels } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

const DETAIL_ID = "loyalty-member-detail"

/** The view `useLoyaltyMembersView` returns. */
export interface LoyaltyMembersViewShape {
    props: {
        slot: DataSlot<{
            rows: {
                tier?: {
                    name: string
                    tone: BadgeTone
                }
                id: string
                label: string
                description: string
            }[]
        }>
        copy: {
            detailId: "loyalty-member-detail"
            detailEmpty: {
                readonly title: string
                readonly body: string
            }
            showMoreLabel?: string
            selectedId: string | null
            empty?: {
                title: string
                body: string
            }
            title: string
            countLabel: string
            search: {
                readonly label: string
                readonly placeholder: string
                readonly value: string
            }
            tier: {
                readonly label: string
                readonly value: string
                readonly options: readonly [
                    {
                        readonly id: "all"
                        readonly label: string
                    },
                    ...{
                        id: string
                        label: string
                    }[],
                ]
            }
            sort: {
                readonly label: string
                readonly value: MemberSortKey
                readonly options: {
                    id: MemberSortKey
                    label: string
                }[]
            }
        }
        labels: SlotLabels
        detail: {
            slot: DataSlot<{
                identity: {
                    asOf: string
                    expiringLine?: string
                    points: string
                    contact: string
                    spentLine: string
                    joinedLine: string
                    nextTierLine: string
                    tier?: {
                        name: string
                        tone: BadgeTone
                    }
                    name: string
                }
                rewardRows: {
                    note?: string
                    blocked?: string
                    id: string
                    name: string
                    cost: string
                }[]
                ledgerRows: {
                    evidence?: string
                    ref?: string
                    dateTime: string
                    timeLabel: string
                    amount?: string
                    id: string
                    kind: string
                    tone: BadgeTone
                    points: string
                }[]
            }>
            labels: SlotLabels
            copy: {
                adjustTitle: string
                adjustBody: string
                adjust: {
                    isPending: boolean
                    note?: string
                    canSubmit: boolean
                    pointsLabel: string
                    pointsHint: string
                    pointsPlaceholder: string
                    reasonLabel: string
                    submitLabel: string
                    pointsError?: string
                    label: string
                    memberId: string
                    points: string
                    reason: string
                }
                rewards: {
                    title: string
                    emptyText: string
                    redeemLabel: string
                    busyId: string | null
                }
                ledger: {
                    title: string
                    emptyText: string
                }
                readOnly?: {
                    items: {
                        id: string
                        term: string
                        description: string
                    }[]
                    note: string
                }
                edit?: {
                    noteMax: number
                    saveLabel: string
                    isPending: boolean
                    nameLabel: string
                    birthdayLabel: string
                    birthdayPlaceholder: string
                    birthdayHint: string
                    noteLabel: string
                    birthdayError?: string
                    nameError?: string
                    label: string
                    memberId: string
                    name: string
                    birthday: string
                    note: string
                }
                closeLabel: string
                editTitle: string
            }
        }
    }
    on: {
        search: (value: string) => void
        setTier: (value: string | null) => void
        setSort: (value: string | null) => void
        select: (id: string | null) => void
        showMore: () => void
        retry: () => void
        detail: {
            redeem: (rewardId: string) => void
            retry: () => void
            edit: {
                onName: (text: string) => void
                onBirthday: (text: string) => void
                onNote: (text: string) => void
                onSubmit: () => void
            }
            adjust: {
                onPoints: (text: string) => void
                onReason: (text: string) => void
                onSubmit: () => void
            }
        }
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
            document.getElementById(DETAIL_ID)?.scrollIntoView({ block: "nearest", behavior: "smooth" })
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

/** Inputs needed to build the LoyaltyMembersContent section. */
interface BuildLoyaltyMembersViewContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly list: ReturnType<typeof useMemberList>
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly format: ReturnType<typeof useFormatter>
    readonly visit: (iso: string | null | undefined) => string
    readonly money: (value: number) => string
}
/** Builds the LoyaltyMembersContent section from the current view. */
const buildLoyaltyMembersView = ({ t, list, board, format, visit, money }: BuildLoyaltyMembersViewContext) =>
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
        ...(list.rows.length === 0
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
        detailEmpty: { title: t("detailEmptyTitle"), body: t("detailEmptyBody") },
    }) as const
