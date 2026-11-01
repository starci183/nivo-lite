import type { DescriptionListStatItem } from "@starci/grammar/common"
import type { ChatbotTranslator } from "@/hooks/chatbot"
import type { ChatbotConversation, ChatbotMetrics } from "@/modules/types"

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

/** Conversations the AI answers by itself: no reply waits for a person and nobody has taken the chat over. */
const handledByAi = (conversation: ChatbotConversation): boolean =>
    conversation.respondent.kind === "ai" && !conversation.waiting && !conversation.unanswered

/** The four figures above the desk: conversations today, those the AI handles alone, those handed to a person, first reply; empty values while the data is not known. */
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
            meta: t("metricTodaySub"),
        },
        {
            id: "auto",
            term: t("metricAuto"),
            description: auto === undefined ? "" : String(auto),
            meta: t("metricAutoSub"),
        },
        {
            id: "handover",
            term: t("metricHandover"),
            description: auto === undefined || conversations === undefined ? "" : String(conversations.length - auto),
            meta: t("metricHandoverSub"),
        },
        { id: "response", term: t("metricResponse"), description: response?.value ?? "", meta: response?.sub ?? "" },
    ]
}
