import type { CaptureChatTruthRequest } from "../../application/capture-chat-truth.contracts"
import type { CaptureChatTruthInput } from "./dto/capture-chat-truth.input"

/** The capture request of the GraphQL input: an absent member stays absent (the capture reads it as null). */
export const toCaptureChatTruthRequest = (workspaceId: string, input: CaptureChatTruthInput): CaptureChatTruthRequest => ({
    workspaceId,
    messageId: input.messageId,
    agentId: input.agentId,
    fact: input.fact,
})
