import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the chat files capability. */
export enum ChatFilesErrorCode {
    /** The file is over the limit, or its stored bytes are not an accepted type. */
    FileInvalid = "CHAT_FILES_INVALID",
    /** The path is not a file of this conversation. */
    PathInvalid = "CHAT_FILES_PATH_INVALID",
    /** The store could not issue an address or read the file. */
    StorageUnavailable = "CHAT_FILES_STORAGE_UNAVAILABLE",
}

/** How each failure travels to the browser. */
export const CHAT_FILES_ERROR_KINDS: Record<ChatFilesErrorCode, ErrorKind> = {
    [ChatFilesErrorCode.FileInvalid]: "invalid",
    [ChatFilesErrorCode.PathInvalid]: "invalid",
    [ChatFilesErrorCode.StorageUnavailable]: "unavailable",
}

/** The one typed error of the chat files capability. */
export class ChatFilesError extends DomainError<ChatFilesErrorCode> {}
