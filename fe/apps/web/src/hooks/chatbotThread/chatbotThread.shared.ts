import {
    FAILED_KEYS,
    SENT_KEYS,
    clockOf,
    dayKeyOf,
    dayWordOf,
    type ChatbotFormat,
    type ChatbotTranslator,
} from "@/hooks/chatbot"
import type { ChatbotChannel, ChatbotMessage, ChatbotThread } from "@/modules/types"

/** The delivery note under an outgoing line, or null when nothing was pushed. */
const deliveryNoteOf = (
    t: ChatbotTranslator,
    message: ChatbotMessage,
    channel: ChatbotChannel,
): { readonly text: string; readonly tone: "accent" | "muted" } | null => {
    if (message.delivery === null && message.authorKind === "human") return { text: t("replyQueued"), tone: "muted" }
    if (message.delivery === "sent") return { text: t(SENT_KEYS[channel]), tone: "muted" }
    if (message.delivery !== "failed") return null
    const reasonKey = message.deliveryError === null ? null : `err_${message.deliveryError}`
    const reason = reasonKey === null || !t.has(reasonKey) ? null : t(reasonKey)
    const text = t(FAILED_KEYS[channel])
    return { text: reason === null ? text : `${text} · ${t("deliveryWhy", { reason })}`, tone: "accent" }
}

/** One entry of the open thread: a day divider, a system line or a message bubble. */
export interface ChatbotThreadEntry {
    readonly id: string
    readonly kind: "day" | "system" | "bubble"
    readonly text: string
    readonly side: "incoming" | "outgoing"
    readonly author: string
    readonly meta: string
    readonly aiMark: string | null
    readonly avatarName: string | null
    readonly deliveryText: string | null
    readonly deliveryTone: "accent" | "muted"
}

const entryOf = (partial: Pick<ChatbotThreadEntry, "id" | "kind" | "text">): ChatbotThreadEntry => ({
    side: "incoming",
    author: "",
    meta: "",
    aiMark: null,
    avatarName: null,
    deliveryText: null,
    deliveryTone: "muted",
    ...partial,
})

/** Who wrote an outgoing line: the member, or the AI. */
const outgoingAuthorOf = (t: ChatbotTranslator, message: ChatbotMessage): string =>
    message.authorKind === "human" ? (message.authorName ?? t("roleAi")) : t("roleAi")

/** The name on the avatar beside a line: the customer, the member who wrote it, or none for the AI. */
const avatarNameOf = (message: ChatbotMessage, human: boolean, customer: string): string | null => {
    if (message.role !== "agent") return customer
    return human ? (message.authorName ?? "?") : null
}

/** The bubble of one customer or agent line. */
const bubbleOf = (
    t: ChatbotTranslator,
    format: ChatbotFormat,
    message: ChatbotMessage,
    channel: ChatbotChannel,
    customer: string,
): ChatbotThreadEntry => {
    const outgoing = message.role === "agent"
    const human = outgoing && message.authorKind === "human"
    const delivery = outgoing ? deliveryNoteOf(t, message, channel) : null
    return {
        ...entryOf({ id: message.id, kind: "bubble", text: message.body }),
        side: outgoing ? "outgoing" : "incoming",
        author: outgoing ? outgoingAuthorOf(t, message) : customer,
        meta: clockOf(format, message.createdAt),
        aiMark: outgoing && !human ? t("aiChip") : null,
        avatarName: avatarNameOf(message, human, customer),
        deliveryText: delivery?.text ?? null,
        deliveryTone: delivery?.tone ?? "muted",
    }
}

/** The thread as entries: a divider whenever the day changes, system lines as dividers, the rest as bubbles. */
export const threadEntriesOf = (
    t: ChatbotTranslator,
    format: ChatbotFormat,
    thread: ChatbotThread,
    customer: string,
    nowIso: string,
): ReadonlyArray<ChatbotThreadEntry> => {
    const entries: Array<ChatbotThreadEntry> = []
    let lastDay = ""
    for (const message of thread.messages) {
        const key = dayKeyOf(message.createdAt)
        if (key !== lastDay) {
            entries.push(entryOf({ id: `day-${key}`, kind: "day", text: dayWordOf(t, format, key, nowIso) }))
            lastDay = key
        }
        if (message.role === "system") entries.push(entryOf({ id: message.id, kind: "system", text: message.body }))
        else entries.push(bubbleOf(t, format, message, thread.conversation.channel, customer))
    }
    return entries
}
