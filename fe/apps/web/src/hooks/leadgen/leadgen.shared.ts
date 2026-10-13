import type { BadgeTone, DescriptionListStatItem } from "@starci/grammar/common"
import type { WorkStatus } from "@/lib/flow-types"
import type { LeadGenMetrics, LeadScore } from "@/modules/types"

/** The tabs of the Lead Gen workbench. */
export const LEADGEN_TABS = ["leads", "sources", "comments", "handoffs"] as const

/** One tab of the Lead Gen workbench. */
export type LeadGenTab = (typeof LEADGEN_TABS)[number]

/** Narrows a text to a tab of the Lead Gen workbench. */
export const leadGenTabOf = (key: string | null | undefined): LeadGenTab | null =>
    LEADGEN_TABS.find((tab) => tab === key) ?? null

/** The badge tone of each score. */
export const SCORE_TONES: Readonly<Record<LeadScore, BadgeTone>> = { hot: "danger", warm: "warning", cold: "neutral" }

/** The badge tone of where the Sales step of a handed-over lead stands. */
export const CLASSIFY_TONES: Readonly<Record<WorkStatus, BadgeTone>> = {
    queued: "neutral",
    done: "success",
    waiting_decision: "warning",
    rejected: "neutral",
    failed: "danger",
}

/** The stages a lead can be in, as the handoff line names them. */
export const LEAD_STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal", "won", "lost"]

const PERCENT = 100

/** The words the figures need, resolved by the caller. */
export type LeadGenWords = (key: string, values?: Record<string, string | number>) => string

const firstReplyOf = (metrics: LeadGenMetrics, t: LeadGenWords): DescriptionListStatItem => ({
    id: "firstReply",
    term: t("figFirstReply"),
    description: metrics.firstReplyP50Min === null ? "—" : String(metrics.firstReplyP50Min),
    unit: metrics.firstReplyP50Min === null ? undefined : t("figFirstReplyUnit"),
    meta:
        metrics.firstReplyP50Min === null
            ? t("figFirstReplyNone")
            : t("figFirstReplyBasis", { n: metrics.firstReplySample }),
})

const conversionOf = (metrics: LeadGenMetrics, t: LeadGenWords): DescriptionListStatItem => ({
    id: "conversion",
    term: t("figConversion"),
    description:
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
export const leadGenFiguresOf = (metrics: LeadGenMetrics, t: LeadGenWords): ReadonlyArray<DescriptionListStatItem> => [
    { id: "newToday", term: t("figNewToday"), description: String(metrics.newToday), meta: t("figNewTodayBasis") },
    {
        id: "hotWaiting",
        term: t("figHotWaiting"),
        description: String(metrics.hotWaiting),
        meta: t("figHotWaitingBasis"),
    },
    firstReplyOf(metrics, t),
    conversionOf(metrics, t),
]
