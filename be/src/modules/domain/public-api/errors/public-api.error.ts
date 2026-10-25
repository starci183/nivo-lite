import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the public-api capability. */
export enum PublicApiErrorCode {
    /** The `since` filter is not an ISO time. */
    SinceInvalid = "PUBLIC_API_SINCE_INVALID",
    /** The workspace has no customer conversation with the requested id or customer. */
    ConversationNotFound = "PUBLIC_API_CONVERSATION_NOT_FOUND",
    /** A message needs a conversation id or a lead id. */
    TargetMissing = "PUBLIC_API_TARGET_MISSING",
    /** The knowledge source text is longer than one source may be. */
    ContentTooLong = "PUBLIC_API_CONTENT_TOO_LONG",
    /** The insert answered no row: the knowledge source was not written. */
    NotWritten = "PUBLIC_API_NOT_WRITTEN",
    /** A queued request is malformed, unsupported, or cannot be reconciled with its ledger. */
    RequestInvalid = "PUBLIC_API_REQUEST_INVALID",
    /** No ledger request belongs to this workspace and request identity. */
    RequestNotFound = "PUBLIC_API_REQUEST_NOT_FOUND",
}

/** How each public-api code travels. */
export const PUBLIC_API_ERROR_KINDS: Record<PublicApiErrorCode, ErrorKind> = {
    [PublicApiErrorCode.SinceInvalid]: "invalid",
    [PublicApiErrorCode.ConversationNotFound]: "not-found",
    [PublicApiErrorCode.TargetMissing]: "invalid",
    [PublicApiErrorCode.ContentTooLong]: "invalid",
    [PublicApiErrorCode.NotWritten]: "internal",
    [PublicApiErrorCode.RequestInvalid]: "invalid",
    [PublicApiErrorCode.RequestNotFound]: "not-found",
}

/** The one error class of the public-api capability. */
export class PublicApiError extends DomainError<PublicApiErrorCode> {}
