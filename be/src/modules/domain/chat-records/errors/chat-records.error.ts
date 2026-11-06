import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the chat-records capability. */
export enum ChatRecordsErrorCode {
    /** The conversation or the message does not exist in the workspace. */
    NotFound = "CHAT_RECORDS_NOT_FOUND",
    /** The engine refused the write: the record was not stored. */
    NotStored = "CHAT_RECORDS_NOT_STORED",
}

/** How each chat-records code travels. */
export const CHAT_RECORDS_ERROR_KINDS: Record<ChatRecordsErrorCode, ErrorKind> = {
    [ChatRecordsErrorCode.NotFound]: "not-found",
    [ChatRecordsErrorCode.NotStored]: "internal",
}

/** The one error class of the chat-records capability. */
export class ChatRecordsError extends DomainError<ChatRecordsErrorCode> {}
