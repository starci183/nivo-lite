import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Typed refusals of member customer replies. */
export enum ChatreplyErrorCode {
    /** The customer conversation or queued reply is absent from this workspace. */
    NotFound = "CHATREPLY_NOT_FOUND",
    /** The conversation must be held by a person before replying. */
    NotHeld = "CHATREPLY_NOT_HELD",
    /** A staff member cannot take another person's held conversation. */
    HeldByOther = "CHATREPLY_HELD_BY_OTHER",
    /** The item is not the waiting answer of this conversation. */
    AnswerMismatch = "CHATREPLY_ANSWER_MISMATCH",
    /** The reply is empty or over its text bound. */
    InvalidBody = "CHATREPLY_INVALID_BODY",
}

/** How each reply refusal reaches the GraphQL client. */
export const CHATREPLY_ERROR_KINDS: Record<ChatreplyErrorCode, ErrorKind> = {
    [ChatreplyErrorCode.NotFound]: "not-found",
    [ChatreplyErrorCode.NotHeld]: "conflict",
    [ChatreplyErrorCode.HeldByOther]: "forbidden",
    [ChatreplyErrorCode.AnswerMismatch]: "invalid",
    [ChatreplyErrorCode.InvalidBody]: "invalid",
}

/** The one error family of customer reply orchestration. */
export class ChatreplyError extends DomainError<ChatreplyErrorCode> {}
