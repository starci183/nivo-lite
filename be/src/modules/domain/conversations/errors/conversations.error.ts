import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the conversations capability. */
export enum ConversationsErrorCode {
    /** The delivery is not a customer message the chat answers (an edited message, a follow, no text) or its body is unreadable. */
    NotAnswered = "CONVERSATIONS_NOT_ANSWERED",
    /** The connection of a customer message holds no account to keep the raw message row in, or the row just kept cannot be read back: nothing is woken for it. */
    MessageNotKept = "CONVERSATIONS_MESSAGE_NOT_KEPT",
}

/** How each conversations code travels. */
export const CONVERSATIONS_ERROR_KINDS: Record<ConversationsErrorCode, ErrorKind> = {
    [ConversationsErrorCode.NotAnswered]: "invalid",
    [ConversationsErrorCode.MessageNotKept]: "internal",
}

/** The one error class of the conversations capability. */
export class ConversationsError extends DomainError<ConversationsErrorCode> {}
