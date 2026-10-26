import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Stable refusals of chat state admission and receipt acknowledgement. */
export enum ChatMarkersErrorCode {
    /** The selected room or conversation is not available in this workspace. */
    TargetNotFound = "CHAT_MARKERS_TARGET_NOT_FOUND",
    /** The supplied message was not persisted in the selected target. */
    MessageNotFound = "CHAT_MARKERS_MESSAGE_NOT_FOUND",
}

/** How chat marker refusals travel over the API. */
export const CHAT_MARKERS_ERROR_KINDS: Record<ChatMarkersErrorCode, ErrorKind> = {
    [ChatMarkersErrorCode.TargetNotFound]: "not-found",
    [ChatMarkersErrorCode.MessageNotFound]: "not-found",
}

/** The typed error of the chat marker capability. */
export class ChatMarkersError extends DomainError<ChatMarkersErrorCode> {}
