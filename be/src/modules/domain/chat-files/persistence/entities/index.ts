import { OfficeFileAttachmentEntity } from "./office-file-attachment.entity"

export { OfficeFileAttachmentEntity }

/** Every entity the chat-files capability owns, collected by the database connection. */
export const chatFilesEntities: readonly [typeof OfficeFileAttachmentEntity] = [OfficeFileAttachmentEntity] as const
