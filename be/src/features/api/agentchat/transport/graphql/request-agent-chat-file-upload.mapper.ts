import type { RequestChatFileUpload } from "@modules/domain/agent-chat"
import type { ChatFileUpload } from "@modules/domain/chat-files"
import type { AgentChatFileUploadType } from "./dto/agent-chat-file-upload.type"
import type { RequestAgentChatFileUploadInput } from "./dto/request-agent-chat-file-upload.input"

/** Maps the GraphQL input and workspace selector to the request. */
export const toRequestAgentChatFileUploadRequest = (
    workspaceId: string,
    input: RequestAgentChatFileUploadInput,
): RequestChatFileUpload => ({
    workspaceId,
    conversationId: input.conversationId,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
})

/** Maps the application result to the GraphQL contract. */
export const toAgentChatFileUploadType = (result: ChatFileUpload): AgentChatFileUploadType => ({ ...result })
