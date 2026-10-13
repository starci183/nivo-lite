import type { PromoChatbotState } from "@modules/domain/promo"
import type { PromoChatbotStateRequest } from "../../application/chatbot-state.contracts"
import type { PromoChatbotStateType } from "./dto/chatbot-state.type"

/** Maps the workspace selector to the application request. */
export const toPromoChatbotStateRequest = (workspaceId: string): PromoChatbotStateRequest => ({ workspaceId })

/** Maps the service result to its GraphQL output. */
export const toPromoChatbotStateType = (result: PromoChatbotState): PromoChatbotStateType => ({ ...result })
