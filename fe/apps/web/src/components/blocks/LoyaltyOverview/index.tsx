"use client"

import { EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr/api/graphql"
import { useFormatter, useTranslations } from "next-intl"
import { useOverviewActions } from "@/hooks/loyaltyOverview"
import { LoyaltyOverviewBase } from "./component"

/** The connected overview: tier meters, 30-day figures, the public check link and the sync of customers into members. */
/** The connected Overview tab: reads the loyalty board itself (SWR shares the one request with the other tabs). */
export const LoyaltyOverview = () => {
    const { data } = useQueryLoyaltyBoardSwr()
    const board = data ?? EMPTY_LOYALTY_BOARD
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const stats = board.stats
    const actions = useOverviewActions(board.program?.slug ?? "")
    const enabled = board.program?.enabled === true
    const maxCount = Math.max(1, ...stats.tierCounts.map((tier) => tier.count))
    const points = (n: number) => t("points", { n: format.number(n) })
    const copiedNote = actions.copied ? t("copiedNote") : t("publicOn")
    return (
        <LoyaltyOverviewBase
            props={{
                ...(stats.members === 0
                    ? {
                          empty: {
                              title: t("emptyMembersTitle"),
                              body: board.canManage ? t("emptyMembersBody") : t("emptyMembersBodyStaff"),
                              ...(board.canManage ? { syncLabel: t("syncButton") } : {}),
                              isSyncing: actions.isPending,
                          },
                      }
                    : {}),
                ...(actions.syncNote === null ? {} : { syncNote: { title: t("syncOk"), text: actions.syncNote } }),
                tiers: {
                    title: t("tiersTitle"),
                    body: t("tiersBody"),
                    rows: stats.tierCounts.map((tier) => ({
                        key: tier.key,
                        label: tier.name,
                        value: tier.count,
                        max: maxCount,
                        valueLabel: t("customers", { n: format.number(tier.count) }),
                    })),
                },
                stats: {
                    title: t("statsTitle"),
                    items: [
                        { id: "earned", term: t("statEarned"), description: points(stats.earned30d) },
                        { id: "expired", term: t("statExpired"), description: points(stats.expired30d) },
                        {
                            id: "redemptions",
                            term: t("statRedemptions"),
                            description: format.number(stats.redemptions30d),
                        },
                        { id: "promos", term: t("statPromos"), description: format.number(stats.promosSent30d) },
                        {
                            id: "birthdays",
                            term: t("statBirthdays"),
                            description: format.number(stats.birthdaysThisMonth),
                        },
                    ],
                },
                link: {
                    title: t("publicTitle"),
                    body: t("publicBody"),
                    url: actions.url,
                    copyLabel: t("copy"),
                    copiedLabel: t("copied"),
                    note: enabled ? copiedNote : t("publicOff"),
                },
            }}
            on={{ sync: actions.sync, copied: actions.markCopied }}
        />
    )
}
