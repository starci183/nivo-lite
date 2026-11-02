import { LEADGEN_TABS, type LeadGenMetrics } from "@/modules/types"
import type { Figure } from "@starci/grammar/common"

type LeadGenTab = (typeof LEADGEN_TABS)[number]

/** The figures before the workbench is read: the terms stay real, the values are skeleton lines. */
export const LEADGEN_PENDING_METRICS: LeadGenMetrics = {
    newToday: 0,
    hotWaiting: 0,
    firstReplyP50Min: null,
    firstReplySample: 0,
    conversionWindowDays: 90,
    conversionLeads: 0,
    conversionWon: 0,
}

/** Narrows a text to a tab of the Lead Gen workbench. */
export const leadGenTabOf = (key: string | null | undefined): LeadGenTab | null =>
    LEADGEN_TABS.find((tab) => tab === key) ?? null

const PERCENT = 100

/** The words the figures need, resolved by the caller. */
export type LeadGenWords = (key: string, values?: Record<string, string | number>) => string

const firstReplyOf = (metrics: LeadGenMetrics, t: LeadGenWords): Figure => ({
    id: "firstReply",
    term: t("figFirstReply"),
    value: metrics.firstReplyP50Min === null ? "—" : String(metrics.firstReplyP50Min),
    ...(metrics.firstReplyP50Min === null ? {} : { unit: t("figFirstReplyUnit") }),
    meta:
        metrics.firstReplyP50Min === null
            ? t("figFirstReplyNone")
            : t("figFirstReplyBasis", { n: metrics.firstReplySample }),
})

const conversionOf = (metrics: LeadGenMetrics, t: LeadGenWords): Figure => ({
    id: "conversion",
    term: t("figConversion"),
    value:
        metrics.conversionLeads === 0
            ? "—"
            : `${Math.round((metrics.conversionWon / metrics.conversionLeads) * PERCENT)}%`,
    meta:
        metrics.conversionLeads === 0
            ? t("figConversionNone", { days: metrics.conversionWindowDays })
            : t("figConversionBasis", {
                  won: metrics.conversionWon,
                  leads: metrics.conversionLeads,
                  days: metrics.conversionWindowDays,
              }),
})

/** The four figures of the Lead Gen ribbon: new today, hot and waiting, first reply, conversion. */
export const leadGenFiguresOf = (metrics: LeadGenMetrics, t: LeadGenWords): ReadonlyArray<Figure> => [
    { id: "newToday", term: t("figNewToday"), value: String(metrics.newToday), meta: t("figNewTodayBasis") },
    {
        id: "hotWaiting",
        term: t("figHotWaiting"),
        value: String(metrics.hotWaiting),
        meta: t("figHotWaitingBasis"),
    },
    firstReplyOf(metrics, t),
    conversionOf(metrics, t),
]
