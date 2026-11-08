import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Stable refusals of the typing hint. */
export enum ChatTypingErrorCode {
    /** The room is not one the caller sits in, or it is not in this workspace. */
    RoomNotFound = "CHAT_TYPING_ROOM_NOT_FOUND",
}

/** How the typing refusals travel over the API. */
export const CHAT_TYPING_ERROR_KINDS: Record<ChatTypingErrorCode, ErrorKind> = {
    [ChatTypingErrorCode.RoomNotFound]: "not-found",
}

/** The typed error of the typing capability. */
export class ChatTypingError extends DomainError<ChatTypingErrorCode> {}
