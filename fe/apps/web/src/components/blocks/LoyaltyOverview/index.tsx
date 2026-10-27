"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useQueryLoyaltyBoardSwr } from "@/hooks/swr"
import { useOverviewActions } from "@/hooks/loyaltyOverview"
import type { LoyaltyBoardType } from "@/hooks/swr"
import { LoyaltyOverviewBase } from "./component"
import type { LoyaltyOverviewData } from "./component"

type LoyaltyTranslator = ReturnType<typeof useTranslations<"loyalty">>
type LoyaltyFormatter = ReturnType<typeof useFormatter>

/** What the overview words besides the board: the translator, the formatter, the link and what it says. */
interface OverviewWords {
    readonly t: LoyaltyTranslator
    readonly format: LoyaltyFormatter
    readonly url: string
    readonly linkNote: string
}

/** Words the board: the empty-members card, the tier meters, the 30-day figures and the public check link. */
const overviewOf = (board: LoyaltyBoardType, words: OverviewWords): LoyaltyOverviewData => {
    const { t, format } = words
    const stats = board.stats
    const maxCount = Math.max(1, ...stats.tierCounts.map((tier) => tier.count))
    const points = (n: number) => t("points", { n: format.number(n) })
    return {
        ...(stats.members === 0
            ? {
                  empty: {
                      title: t("emptyMembersTitle"),
                      body: board.canManage ? t("emptyMembersBody") : t("emptyMembersBodyStaff"),
                      ...(board.canManage ? { syncLabel: t("syncButton") } : {}),
                  },
              }
            : {}),
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
                { id: "redemptions", term: t("statRedemptions"), description: format.number(stats.redemptions30d) },
                { id: "promos", term: t("statPromos"), description: format.number(stats.promosSent30d) },
                { id: "birthdays", term: t("statBirthdays"), description: format.number(stats.birthdaysThisMonth) },
            ],
        },
        link: {
            title: t("publicTitle"),
            body: t("publicBody"),
            url: words.url,
            copyLabel: t("copy"),
            copiedLabel: t("copied"),
            note: words.linkNote,
        },
    }
}

/** The connected Overview tab: reads the loyalty board itself (SWR shares the one request with the other tabs); tier meters, 30-day figures, the public check link and the sync of customers into members. */
export const LoyaltyOverview = () => {
    const read = useQueryLoyaltyBoardSwr()
    const slotLabels = useSlotLabels()
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const board = read.data
    const actions = useOverviewActions(board?.program?.slug ?? "")
    const copiedNote = actions.copied ? t("copiedNote") : t("publicOn")
    const linkNote = board?.program?.enabled === true ? copiedNote : t("publicOff")
    const words: OverviewWords = { t, format, url: actions.url, linkNote }
    return (
        <LoyaltyOverviewBase
            props={{
                slot: mapSlot(slotOfSwr(read), (loaded) => overviewOf(loaded, words)),
                slotLabels: slotLabels(t("emptyMembersTitle")),
                isSyncing: actions.isPending,
                ...(actions.syncNote === null ? {} : { syncNote: { title: t("syncOk"), text: actions.syncNote } }),
            }}
            on={{ sync: actions.sync, copied: actions.markCopied, retry: () => void read.mutate() }}
        />
    )
}
