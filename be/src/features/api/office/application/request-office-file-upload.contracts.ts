import type { ChatFileFacts } from "@modules/domain/chat-files"

/** A file about to be uploaded for an Office line. */
export interface RequestOfficeFileUploadRequest extends ChatFileFacts {
    /** The workspace. */
    readonly workspaceId: string
}
