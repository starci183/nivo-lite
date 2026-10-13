import type { ChatbotOverview } from "@modules/domain/chatbot-workbench"
import type { GetChatbotOverviewRequest } from "../../application/get-chatbot-overview.contracts"
import type { ChatbotOverviewInput } from "./dto/chatbot-overview.input"
import type { ChatbotOverviewType } from "./dto/chatbot-overview.type"

/** Maps the transport's selected workspace and input to its application request. */
export const toChatbotOverviewRequest = (
    workspaceId: string,
    input: ChatbotOverviewInput,
): GetChatbotOverviewRequest => ({ workspaceId, installationId: input.installationId })

/** Maps the domain overview to its GraphQL type. */
export const toChatbotOverviewType = (result: ChatbotOverview): ChatbotOverviewType => ({
    ...result,
    conversations: result.conversations.map((conversation) => ({ ...conversation })),
    metrics: { ...result.metrics },
})
