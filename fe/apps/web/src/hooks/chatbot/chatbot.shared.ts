import type { useFormatter, useTranslations } from "next-intl"
import type { ChatbotChannel, ChatbotConversation, ChatbotLead } from "@/modules/types"

/** The translator of the Chatbot catalog namespace. */
export type ChatbotTranslator = ReturnType<typeof useTranslations>

/** The reader's number and date formatter (next-intl, product time zone). */
export type ChatbotFormat = ReturnType<typeof useFormatter>

/** The filters of the conversation list. */
export type InboxFilter = "all" | "needs" | "handled" | "today"

/** The ids of the filters, in the order the list offers them. */
export const INBOX_FILTERS: ReadonlyArray<InboxFilter> = ["all", "needs", "handled", "today"]

const FILTER_KEYS: Readonly<Record<InboxFilter, string>> = {
    all: "filterAll",
    needs: "filterNeedsPerson",
    handled: "filterHandled",
    today: "filterToday",
}

const CHANNEL_KEYS: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "channelTelegram",
    zalo: "channelZalo",
    facebook: "channelFacebook",
    instagram: "channelInstagram",
    website: "channelWebsite",
}

const CHANNEL_LINE_KEYS: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "channelTelegramLine",
    zalo: "channelZaloLine",
    facebook: "channelFacebookLine",
    instagram: "channelInstagramLine",
    website: "channelWebsiteLine",
}

const HINT_KEYS: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "composerHintTelegram",
    zalo: "composerHintZalo",
    facebook: "composerHintMeta",
    instagram: "composerHintMeta",
    website: "composerHintWebsite",
}

/** Catalog key of the note under a line that reached the customer, by channel. */
export const SENT_KEYS: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "deliverySent",
    zalo: "deliverySentZalo",
    facebook: "deliverySentMeta",
    instagram: "deliverySentMeta",
    website: "deliveryWebsite",
}

/** Catalog key of the note under a line that did not reach the customer, by channel. */
export const FAILED_KEYS: Readonly<Record<ChatbotChannel, string>> = {
    telegram: "deliveryFailed",
    zalo: "deliveryFailedZalo",
    facebook: "deliveryFailedMeta",
    instagram: "deliveryFailedMeta",
    website: "deliveryFailed",
}

const DAY_MS = 86_400_000
const VIETNAM_OFFSET_MS = 7 * 3_600_000

/** Whether a string names a filter. */
export const isInboxFilter = (value: string): value is InboxFilter => INBOX_FILTERS.some((filter) => filter === value)

/** Calendar-day key (Vietnam time) used to group messages. */
export const dayKeyOf = (iso: string): string =>
    new Date(new Date(iso).getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** Whether a conversation belongs to a filter. */
export const matchesInboxFilter = (conversation: ChatbotConversation, filter: InboxFilter, nowIso: string): boolean => {
    if (filter === "needs") return conversation.waiting
    if (filter === "handled") return conversation.handledBy !== null
    return filter === "all" || dayKeyOf(conversation.lastAt) === dayKeyOf(nowIso)
}

/** The words of a filter. */
export const filterLabelOf = (t: ChatbotTranslator, filter: InboxFilter): string => t(FILTER_KEYS[filter])

/** The name of a channel. */
export const channelLabelOf = (t: ChatbotTranslator, channel: ChatbotChannel): string => t(CHANNEL_KEYS[channel])

/** The line that says which channel a customer wrote from. */
export const channelLineOf = (t: ChatbotTranslator, channel: ChatbotChannel): string => t(CHANNEL_LINE_KEYS[channel])

/** The hint under the composer: where the reply goes. */
export const composerHintOf = (t: ChatbotTranslator, channel: ChatbotChannel, name: string): string =>
    t(HINT_KEYS[channel], { name })

/** One state mark of a conversation. */
export interface ChatbotChipView {
    readonly id: string
    readonly label: string
    readonly tone: "warning" | "accent" | "neutral"
    readonly isDot: boolean
}

/** State chips of one conversation: who is replying and whether somebody is needed. */
export const chipsOf = (t: ChatbotTranslator, conversation: ChatbotConversation): ReadonlyArray<ChatbotChipView> => {
    const chips: Array<ChatbotChipView> = []
    if (conversation.waiting) chips.push({ id: "waiting", label: t("chipWaiting"), tone: "warning", isDot: true })
    if (conversation.handledBy !== null) {
        chips.push({
            id: "handled",
            label: t("chipHandled", { name: conversation.handledBy }),
            tone: "accent",
            isDot: true,
        })
    }
    if (!conversation.waiting && conversation.handledBy === null) {
        chips.push({ id: "ai", label: t("chipAi"), tone: "neutral", isDot: false })
    }
    if (conversation.unanswered && !conversation.waiting) {
        chips.push({ id: "unanswered", label: t("chipUnanswered"), tone: "warning", isDot: false })
    }
    return chips
}

/** The clock time of an instant in the product time zone. */
export const clockOf = (format: ChatbotFormat, iso: string): string =>
    format.dateTime(new Date(iso), { hour: "2-digit", minute: "2-digit" })

/** Clock time for today, otherwise "Yesterday" or a short date. */
export const dayWordOf = (t: ChatbotTranslator, format: ChatbotFormat, key: string, nowIso: string): string => {
    if (key === dayKeyOf(nowIso)) return t("today")
    if (key === dayKeyOf(new Date(new Date(nowIso).getTime() - DAY_MS).toISOString())) return t("yesterday")
    return format.dateTime(new Date(`${key}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" })
}

/** List-row time: clock time today, otherwise "Yesterday" or a short date. */
export const listTimeOf = (t: ChatbotTranslator, format: ChatbotFormat, iso: string, nowIso: string): string => {
    const key = dayKeyOf(iso)
    return key === dayKeyOf(nowIso) ? clockOf(format, iso) : dayWordOf(t, format, key, nowIso)
}

const STAGES: ReadonlyArray<string> = ["new", "qualified", "proposal", "won", "lost"]

/** The lead's facts as term and value pairs; a fact without a value is left out. */
export const leadFactsOf = (
    t: ChatbotTranslator,
    lead: ChatbotLead,
): ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }> =>
    [
        {
            id: "stage",
            term: t("leadStage"),
            description: STAGES.includes(lead.stage) ? t(`stage_${lead.stage}`) : lead.stage,
        },
        { id: "need", term: t("leadNeed"), description: lead.need },
        { id: "phone", term: t("leadPhone"), description: lead.phone ?? "" },
        { id: "email", term: t("leadEmail"), description: lead.email ?? "" },
    ].filter((fact) => fact.description !== "")

/** Who is replying, in one sentence. */
export const handlingTextOf = (t: ChatbotTranslator, handledBy: string | null, userName: string): string => {
    if (handledBy === null) return t("handlingAi")
    return handledBy === userName ? t("handlingYou") : t("handlingOther", { name: handledBy })
}
