import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the email-messages capability. */
export enum EmailMessagesErrorCode {
    /** The insert answered no row: the send attempt was not recorded. */
    NotRecorded = "EMAIL_MESSAGES_NOT_RECORDED",
}

/** How each email-messages code travels. */
export const EMAIL_MESSAGES_ERROR_KINDS: Record<EmailMessagesErrorCode, ErrorKind> = {
    [EmailMessagesErrorCode.NotRecorded]: "internal",
}

/** The one error class of the email-messages capability. */
export class EmailMessagesError extends DomainError<EmailMessagesErrorCode> {}
