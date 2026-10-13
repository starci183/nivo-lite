import type { DescriptionListStatItem } from "@starci/grammar/common"
import type { ChatbotTranslator } from "@/hooks/chatbot"
import type { ChatbotMetrics } from "@/modules/types"

/** The first-reply figure: its value and the line under it. */
const responseOf = (
    t: ChatbotTranslator,
    metrics: ChatbotMetrics,
): { readonly value: string; readonly sub: string } => {
    const minutes = metrics.p50FirstResponseMin
    if (minutes === null) return { value: "-", sub: t("metricResponseNone") }
    const sub = t("metricResponseSub", { n: metrics.sample })
    if (minutes < 1) return { value: t("seconds", { n: Math.max(1, Math.round(minutes * 60)) }), sub }
    return { value: t("minutes", { n: Math.round(minutes * 10) / 10 }), sub }
}

/** The four figures above the inbox; empty values while the metrics are not known. */
export const figuresOf = (
    t: ChatbotTranslator,
    metrics: ChatbotMetrics | undefined,
): ReadonlyArray<DescriptionListStatItem> => {
    const response = metrics === undefined ? undefined : responseOf(t, metrics)
    return [
        {
            id: "today",
            term: t("metricToday"),
            description: metrics === undefined ? "" : String(metrics.today),
            meta: t("metricTodaySub"),
        },
        {
            id: "waiting",
            term: t("metricWaiting"),
            description: metrics === undefined ? "" : String(metrics.waiting),
            meta: t("metricWaitingSub"),
        },
        { id: "response", term: t("metricResponse"), description: response?.value ?? "", meta: response?.sub ?? "" },
        {
            id: "leads",
            term: t("metricLeads"),
            description: metrics === undefined ? "" : String(metrics.leadsCaptured7d),
            meta: t("metricLeadsSub"),
        },
    ]
}
