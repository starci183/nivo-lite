import type { ChatbotThread } from "@modules/domain/chatbot-workbench"
import type { GetChatbotThreadRequest } from "../../application/get-chatbot-thread.contracts"
import type { ChatbotThreadInput } from "./dto/chatbot-thread.input"
import type { ChatbotThreadType } from "./dto/chatbot-thread.type"

/** Maps the transport's selected workspace and input to its application request. */
export const toChatbotThreadRequest = (workspaceId: string, input: ChatbotThreadInput): GetChatbotThreadRequest => ({
    workspaceId,
    conversationId: input.conversationId,
})

/** Maps the domain thread to its GraphQL type. */
export const toChatbotThreadType = (result: ChatbotThread): ChatbotThreadType => ({
    ...result,
    conversation: { ...result.conversation },
    messages: result.messages.map((message) => ({ ...message })),
    lead: result.lead,
    escalation: result.escalation,
})
