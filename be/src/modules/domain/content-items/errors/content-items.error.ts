import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the content-items capability. */
export enum ContentItemsErrorCode {
    /** No post exists in the selected workspace. */
    NotFound = "CONTENT_ITEMS_NOT_FOUND",
    /** Invalid fields or workspace references. */
    InvalidInput = "CONTENT_ITEMS_INVALID_INPUT",
    /** A lifecycle transition is not permitted. */
    WrongStatus = "CONTENT_ITEMS_WRONG_STATUS",
    /** Reopen the post before editing its text. */
    Frozen = "CONTENT_ITEMS_FROZEN",
    /** Every channel needs draft text. */
    TextMissing = "CONTENT_ITEMS_TEXT_MISSING",
    /** A write that must answer the row it wrote answered none. */
    NotWritten = "CONTENT_ITEMS_NOT_WRITTEN",
}

/** How each content-items code travels. */
export const CONTENT_ITEMS_ERROR_KINDS: Record<ContentItemsErrorCode, ErrorKind> = {
    [ContentItemsErrorCode.NotFound]: "not-found",
    [ContentItemsErrorCode.InvalidInput]: "invalid",
    [ContentItemsErrorCode.WrongStatus]: "conflict",
    [ContentItemsErrorCode.Frozen]: "conflict",
    [ContentItemsErrorCode.TextMissing]: "invalid",
    [ContentItemsErrorCode.NotWritten]: "internal",
}

/** The one error class of the content-items capability. */
export class ContentItemsError extends DomainError<ContentItemsErrorCode> {}
