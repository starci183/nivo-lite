import { EMPTY_LOYALTY_BOARD } from "@/hooks/loyalty"
import type { LoyaltyPanelInput } from "@/hooks/loyalty"
import { toast } from "@/modules/toast"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { useOverviewActions } from "@/hooks/loyaltyOverview"
import type { LoyaltyBoardType } from "@/hooks/swr"
import type { DataSlot, SlotLabels } from "@/modules/types"

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
const overviewOf = (board: LoyaltyBoardType, words: OverviewWords) => {
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

/** The view `useLoyaltyOverviewView` returns. */
export interface LoyaltyOverviewView {
    props: {
        syncNote?: {
            title: string
            description: string
        }
        slot: DataSlot<{
            tiers: {
                key: string
                label: string
                value: number
                max: number
                valueLabel: string
            }[]
            stats: {
                id: string
                term: string
                description: string
            }[]
            linkUrl: string
        }>
        copy: {
            tiers: {
                title: string
                body: string
            }
            stats: {
                title: string
            }
            link: {
                title: string
                body: string
                copyLabel: string
                copiedLabel: string
                note: string
            }
            empty?: {
                syncLabel?: string
                title: string
                body: string
            }
        }
        labels: SlotLabels
        isSyncing: boolean
    }
    on: {
        sync: () => void
        copied: () => void
        retry: () => void
    }
}

/** The connected Overview tab: reads the loyalty board itself (SWR shares the one request with the other tabs); tier meters, 30-day figures, the public check link and the sync of customers into members. */
export const useLoyaltyOverviewView = (input: LoyaltyPanelInput): LoyaltyOverviewView => {
    const read = input.read
    const slotLabels = useSlotLabels()
    const retry = () => {
        input.read.mutate().catch(() => toast.danger(slotLabels("").error))
    }
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const board = read.data
    const actions = useOverviewActions(board?.program?.slug ?? "", input)
    const copiedNote = actions.copied ? t("copiedNote") : t("publicOn")
    const linkNote = board?.program?.enabled === true ? copiedNote : t("publicOff")
    const words: OverviewWords = { t, format, url: actions.url, linkNote }
    const data = overviewOf(board ?? EMPTY_LOYALTY_BOARD, words)
    const { rows: tiers, ...tierCopy } = data.tiers
    const { items: stats, ...statsCopy } = data.stats
    const { url: linkUrl, ...linkCopy } = data.link
    return {
        props: {
            slot: mapSlot(slotOfSwr(read), () => ({ tiers, stats, linkUrl })),
            copy: {
                ...(board === undefined || data.empty === undefined ? {} : { empty: data.empty }),
                tiers: tierCopy,
                stats: statsCopy,
                link: linkCopy,
            },
            labels: slotLabels(t("emptyMembersTitle")),
            isSyncing: actions.isPending,
            ...(actions.syncNote === null ? {} : { syncNote: { title: t("syncOk"), description: actions.syncNote } }),
        },
        on: { sync: actions.sync, copied: actions.markCopied, retry: retry },
    }
}
