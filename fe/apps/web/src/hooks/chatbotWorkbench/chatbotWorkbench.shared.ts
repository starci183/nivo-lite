import type { DescriptionListStatItem } from "@starci/grammar/common"
import type { ChatbotTranslator } from "@/hooks/chatbot"
import type { ChatbotConversation, ChatbotMetrics } from "@/modules/types"

/** The line under a figure: the period it covers first (today, right now, the last 30 days), then what it counts. */
const subOf = (t: ChatbotTranslator, period: "Today" | "Now" | "Month", what: string): string =>
    t("metricSub", { period: t(`metricPeriod${period}`), what })

/** The first-reply figure: its value and the line under it (a median of the last 30 days). */
const responseOf = (
    t: ChatbotTranslator,
    metrics: ChatbotMetrics,
): { readonly value: string; readonly sub: string } => {
    const minutes = metrics.p50FirstResponseMin
    if (minutes === null) return { value: "-", sub: subOf(t, "Month", t("metricResponseNone")) }
    const sub = subOf(t, "Month", t("metricResponseSub", { n: metrics.sample }))
    if (minutes < 1) return { value: t("seconds", { n: Math.max(1, Math.round(minutes * 60)) }), sub }
    return { value: t("minutes", { n: Math.round(minutes * 10) / 10 }), sub }
}

/** Conversations the AI answers by itself: no reply waits for a person and nobody has taken the chat over. */
const handledByAi = (conversation: ChatbotConversation): boolean =>
    conversation.respondent.kind === "ai" && !conversation.waiting && !conversation.unanswered

/**
 * The four figures above the desk, each naming its own period: conversations opened today, those the AI handles alone and those
 * handed to a person right now, and the first reply of the last 30 days; empty values while the data is not known.
 */
export const chatbotFiguresOf = (
    t: ChatbotTranslator,
    metrics: ChatbotMetrics | undefined,
    conversations: ReadonlyArray<ChatbotConversation> | undefined,
): ReadonlyArray<DescriptionListStatItem> => {
    const response = metrics === undefined ? undefined : responseOf(t, metrics)
    const auto = conversations?.filter(handledByAi).length
    return [
        {
            id: "today",
            term: t("metricToday"),
            description: metrics === undefined ? "" : String(metrics.today),
            meta: subOf(t, "Today", t("metricTodaySub")),
        },
        {
            id: "auto",
            term: t("metricAuto"),
            description: auto === undefined ? "" : String(auto),
            meta: subOf(t, "Now", t("metricAutoSub")),
        },
        {
            id: "handover",
            term: t("metricHandover"),
            description: auto === undefined || conversations === undefined ? "" : String(conversations.length - auto),
            meta: subOf(t, "Now", t("metricHandoverSub")),
        },
        { id: "response", term: t("metricResponse"), description: response?.value ?? "", meta: response?.sub ?? "" },
    ]
}
