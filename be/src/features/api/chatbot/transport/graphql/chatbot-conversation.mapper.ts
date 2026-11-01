import type { ChatbotConversation } from "@modules/domain/chatbot-workbench"
import type { ChatbotConversationType } from "./dto/chatbot-conversation.type"

/** Maps a domain conversation to its GraphQL type; the respondent travels as a kind and a name. */
export const toChatbotConversationType = (conversation: ChatbotConversation): ChatbotConversationType => ({
    id: conversation.id,
    channel: conversation.channel,
    name: conversation.name,
    leadId: conversation.leadId,
    lastText: conversation.lastText,
    lastRole: conversation.lastRole,
    lastAt: conversation.lastAt,
    messageCount: conversation.messageCount,
    handledBy: conversation.handledBy,
    waiting: conversation.waiting,
    unanswered: conversation.unanswered,
    lead: conversation.lead,
    respondentKind: conversation.respondent.kind,
    respondentName: conversation.respondent.name,
})
