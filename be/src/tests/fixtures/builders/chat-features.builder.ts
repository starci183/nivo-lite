import type { ChatConversationTarget, ChatHumanConversation, ChatTurnConversation } from "@modules/domain/chat-records"

/** Where the replies of a Telegram conversation go; a spec overrides what it varies. */
export const chatTarget = (patch: Partial<ChatConversationTarget> = {}): ChatConversationTarget => ({
    id: "conv-1",
    workspaceId: "ws-1",
    channel: "telegram",
    externalId: "555",
    connectionId: "c-1",
    ...patch,
})

/** A conversation a member may hold. */
export const humanConversation = (patch: Partial<ChatHumanConversation> = {}): ChatHumanConversation => ({
    ...chatTarget(),
    leadId: null,
    handledBy: null,
    ...patch,
})

/** The conversation a turn answers, with the chatbot agent that speaks in it. */
export const turnConversation = (patch: Partial<ChatTurnConversation> = {}): ChatTurnConversation => ({
    ...chatTarget(),
    leadId: null,
    handledBy: null,
    visitorName: "Minh",
    installationId: null,
    agent: {
        id: "agent-1",
        name: "Chatbot",
        handle: "chatbot",
        role: "Customer chat",
        module: "chatbot",
        instructions: "Be kind",
        knowledge: "Tea",
        approvalRule: "ask",
        greeting: "Hi",
    },
    speaksAs: null,
    ...patch,
})
