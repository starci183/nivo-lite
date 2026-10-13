import type { useQueryChatbotOverviewSwr, useQueryChatbotThreadSwr } from "@/hooks/swr"
import type { ChatbotChannel, ChatbotConversation, ChatbotOverview, ChatbotRole, ChatbotThread } from "@/modules/types"

/** The overview exactly as the back end answers it. */
export type ChatbotOverviewWire = NonNullable<ReturnType<typeof useQueryChatbotOverviewSwr>["data"]>

/** The thread exactly as the back end answers it. */
export type ChatbotThreadWire = NonNullable<ReturnType<typeof useQueryChatbotThreadSwr>["data"]>

type ChatbotConversationWire = ChatbotOverviewWire["conversations"][number]

const channelOf = (channel: string): ChatbotChannel => {
    if (channel === "telegram" || channel === "zalo" || channel === "facebook" || channel === "instagram")
        return channel
    return "website"
}

const roleOf = (role: string): ChatbotRole => (role === "agent" || role === "system" ? role : "user")

const conversationOf = (conversation: ChatbotConversationWire): ChatbotConversation => ({
    ...conversation,
    channel: channelOf(conversation.channel),
    handledBy: conversation.handledBy ?? null,
    leadId: conversation.leadId ?? null,
    lastRole: conversation.lastRole == null ? null : roleOf(conversation.lastRole),
})

/** Normalizes the open and string-typed fields of the inbox overview into the presentation types. */
export const overviewOf = (overview: ChatbotOverviewWire): ChatbotOverview => ({
    ...overview,
    conversations: overview.conversations.map(conversationOf),
    metrics: { ...overview.metrics, p50FirstResponseMin: overview.metrics.p50FirstResponseMin ?? null },
})

/** Normalizes the open and string-typed fields of one thread into the presentation types. */
export const threadOf = (thread: ChatbotThreadWire): ChatbotThread => ({
    ...thread,
    conversation: conversationOf(thread.conversation),
    messages: thread.messages.map((message) => ({
        ...message,
        role: roleOf(message.role),
        authorKind: message.authorKind === "human" ? "human" : "ai",
        authorName: message.authorName ?? null,
        delivery: message.delivery === "sent" || message.delivery === "failed" ? message.delivery : null,
        deliveryError: message.deliveryError ?? null,
    })),
    lead:
        thread.lead == null
            ? null
            : { ...thread.lead, phone: thread.lead.phone ?? null, email: thread.lead.email ?? null },
    escalation:
        thread.escalation == null ? null : { ...thread.escalation, staffName: thread.escalation.staffName ?? null },
    externalId: thread.externalId ?? null,
    handledAt: thread.handledAt ?? null,
})
