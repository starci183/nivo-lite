import type { ChatbotGaps } from "@modules/domain/chatbot-workbench"
import type { GetChatbotGapsRequest } from "../../application/get-chatbot-gaps.contracts"
import type { ChatbotGapsType } from "./dto/chatbot-gaps.type"

/** Maps the transport's selected workspace to its application request. */
export const toChatbotGapsRequest = (workspaceId: string): GetChatbotGapsRequest => ({ workspaceId })

/** Maps the domain gaps to its GraphQL type. */
export const toChatbotGapsType = (result: ChatbotGaps): ChatbotGapsType => ({
    gaps: result.gaps.map((gap) => ({ ...gap })),
    lenses: result.lenses.map((lens) => ({ ...lens })),
})
