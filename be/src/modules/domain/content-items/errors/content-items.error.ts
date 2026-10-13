import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the content-items capability. */
export enum ContentItemsErrorCode {
    /** A write that must answer the row it wrote answered none. */
    NotWritten = "CONTENT_ITEMS_NOT_WRITTEN",
}

/** How each content-items code travels. */
export const CONTENT_ITEMS_ERROR_KINDS: Record<ContentItemsErrorCode, ErrorKind> = {
    [ContentItemsErrorCode.NotWritten]: "internal",
}

/** The one error class of the content-items capability. */
export class ContentItemsError extends DomainError<ContentItemsErrorCode> {}
