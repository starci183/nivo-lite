import { builder } from "@starci/jest-preset"
import { chatFilesEntities } from "@modules/domain/chat-files"

const AttachmentEntity: (typeof chatFilesEntities)[0] = chatFilesEntities[0]
type OfficeFileAttachmentEntity = InstanceType<typeof AttachmentEntity>

/** A stored attachment with stable identity and database timestamps, before its contents have been read. */
export const chatFileAttachmentOf: (overrides?: Partial<OfficeFileAttachmentEntity>) => OfficeFileAttachmentEntity =
    builder<InstanceType<typeof AttachmentEntity>>({
        id: "attachment-1",
        workspaceId: "ws-1",
        messageId: "m-1",
        path: "ws-1/chat/office/0f8fad5b-d9cb-469f-a165-70867728950e.png",
        name: "a.png",
        contentType: "image/png",
        sizeBytes: 9,
        read: null,
        createdAt: new Date("2026-11-01T00:00:00.000Z"),
        updatedAt: new Date("2026-11-01T00:00:00.000Z"),
    })

/** Two addressed attachments, allowing a signing response to keep one and omit the missing object. */
export const chatFileAttachmentRowsOf = (): Array<OfficeFileAttachmentEntity> => [
    chatFileAttachmentOf(),
    chatFileAttachmentOf({
        id: "attachment-2",
        messageId: "m-2",
        path: "ws-1/chat/office/missing.pdf",
        name: "missing.pdf",
    }),
]

/** The chat files of a thread that holds none. */
export const NO_CHAT_FILES = {
    viewsOf: (): Promise<Array<never>> => Promise.resolve([]),
    wordsOf: (written: string): string => written,
}

/** The reads of a turn whose message holds no file. */
export const NO_CHAT_FILE_READS = {
    readOf: (): Promise<null> => Promise.resolve(null),
    attachmentsOf: (): Promise<Array<never>> => Promise.resolve([]),
    documentBlockOf: (): Promise<null> => Promise.resolve(null),
}
