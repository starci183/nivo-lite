import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the messages capability. */
export enum MessagesErrorCode {
    /** A result card payload breaks the card contract; the reason rides in the params. */
    CardInvalid = "MESSAGES_CARD_INVALID",
}

/** How each messages code travels. */
export const MESSAGES_ERROR_KINDS: Record<MessagesErrorCode, ErrorKind> = {
    [MessagesErrorCode.CardInvalid]: "invalid",
}

/** The one error class of the messages capability. */
export class MessagesError extends DomainError<MessagesErrorCode> {}
