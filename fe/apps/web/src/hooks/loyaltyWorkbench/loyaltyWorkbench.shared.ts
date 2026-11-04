import type { useTranslations, useFormatter } from "next-intl"
import { EMPTY_LOYALTY_BOARD, findTier, tierTone } from "@/hooks/loyalty"
import { MEMBER_SORTS, groupPhone, useMemberList } from "@/hooks/loyaltyMembers"
import type { BadgeTone } from "@starci/grammar/common"
import type { MemberSortKey } from "@/hooks/loyaltyMembers"

/** The id of the member detail pane the list scrolls to. */
export const LOYALTY_MEMBER_DETAIL_ID = "loyalty-member-detail"

/** The list rows and the section copy of the members tab, as the builder draws them. */
export interface LoyaltyMembersBuilt {
    rows: {
        tier?: {
            name: string
            tone: BadgeTone
        }
        id: string
        label: string
        description: string
    }[]
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

/** Inputs needed to build the LoyaltyMembersContent section. */
export interface BuildLoyaltyMembersViewContext {
    readonly t: ReturnType<typeof useTranslations<"loyalty">>
    readonly list: ReturnType<typeof useMemberList>
    readonly board: typeof EMPTY_LOYALTY_BOARD
    readonly format: ReturnType<typeof useFormatter>
    readonly visit: (iso: string | null | undefined) => string
    readonly money: (value: number) => string
}

/** Builds the LoyaltyMembersContent section from the current view. */
export const buildLoyaltyMembersView = ({
    t,
    list,
    board,
    format,
    visit,
    money,
}: BuildLoyaltyMembersViewContext): LoyaltyMembersBuilt =>
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
        detailId: LOYALTY_MEMBER_DETAIL_ID,
        detailEmpty: { title: t("detailEmptyTitle"), body: t("detailEmptyBody") },
    }) as const
