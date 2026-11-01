import { AgentMessageAttachmentEntity } from "./agent-message-attachment.entity"

export { AgentMessageAttachmentEntity }

/** Every entity the chat-files capability owns, collected by the database connection. */
export const chatFilesEntities = [AgentMessageAttachmentEntity] as const
