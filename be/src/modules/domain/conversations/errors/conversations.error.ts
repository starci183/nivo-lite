import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the conversations capability. */
export enum ConversationsErrorCode {
    /** The delivery is not a customer message the chat answers (an edited message, a follow, no text) or its body is unreadable. */
    NotAnswered = "CONVERSATIONS_NOT_ANSWERED",
    /** The conversation or the customer message of a turn no longer exists. */
    TurnTargetMissing = "CONVERSATIONS_TURN_TARGET_MISSING",
}

/** How each conversations code travels. */
export const CONVERSATIONS_ERROR_KINDS: Record<ConversationsErrorCode, ErrorKind> = {
    [ConversationsErrorCode.NotAnswered]: "invalid",
    [ConversationsErrorCode.TurnTargetMissing]: "not-found",
}

/** The one error class of the conversations capability. */
export class ConversationsError extends DomainError<ConversationsErrorCode> {}
