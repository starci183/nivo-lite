import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the public-documents capability. */
export enum PublicDocumentsErrorCode {
    /** No public document of the workspace has this id. */
    NotFound = "PUBLIC_DOCUMENTS_NOT_FOUND",
    /** A public document needs a title. */
    TitleRequired = "PUBLIC_DOCUMENTS_TITLE_REQUIRED",
    /** A public document needs text before it is approved. */
    BodyRequired = "PUBLIC_DOCUMENTS_BODY_REQUIRED",
    /** The text is longer than a public document may be. */
    BodyTooLong = "PUBLIC_DOCUMENTS_BODY_TOO_LONG",
    /** A draft needs at least one public-area document to be written from. */
    SourcesRequired = "PUBLIC_DOCUMENTS_SOURCES_REQUIRED",
    /** A draft is written from a few public-area documents at most. */
    TooManySources = "PUBLIC_DOCUMENTS_TOO_MANY_SOURCES",
    /** A document chosen for a draft is missing or not fully read yet. */
    SourceNotReady = "PUBLIC_DOCUMENTS_SOURCE_NOT_READY",
    /** A document chosen for a draft is in the INTERNAL area (or its area cannot be read): it must be moved to the public area first. */
    SourceInternal = "PUBLIC_DOCUMENTS_SOURCE_INTERNAL",
    /** The document is being drafted or archived, so its text cannot change now. */
    NotEditable = "PUBLIC_DOCUMENTS_NOT_EDITABLE",
    /** An internal source changed since the owner approved: the owner reviews the change first. */
    SourcesChanged = "PUBLIC_DOCUMENTS_SOURCES_CHANGED",
    /** The content changed after the approver read it, so that review cannot publish the current revision. */
    StaleReview = "PUBLIC_DOCUMENTS_STALE_REVIEW",
    /** No agent holds the right to read internal documents, so nothing can be drafted from them. */
    NoInternalRight = "PUBLIC_DOCUMENTS_NO_INTERNAL_RIGHT",
    /** The model could not draft the text. */
    DraftUnavailable = "PUBLIC_DOCUMENTS_DRAFT_UNAVAILABLE",
    /** The chosen documents hold nothing to write the text from. */
    NothingLeft = "PUBLIC_DOCUMENTS_NOTHING_LEFT",
}

/** How each public-documents code travels. */
export const PUBLIC_DOCUMENTS_ERROR_KINDS: Record<PublicDocumentsErrorCode, ErrorKind> = {
    [PublicDocumentsErrorCode.NotFound]: "not-found",
    [PublicDocumentsErrorCode.TitleRequired]: "invalid",
    [PublicDocumentsErrorCode.BodyRequired]: "invalid",
    [PublicDocumentsErrorCode.BodyTooLong]: "invalid",
    [PublicDocumentsErrorCode.SourcesRequired]: "invalid",
    [PublicDocumentsErrorCode.TooManySources]: "invalid",
    [PublicDocumentsErrorCode.SourceNotReady]: "invalid",
    [PublicDocumentsErrorCode.SourceInternal]: "invalid",
    [PublicDocumentsErrorCode.NotEditable]: "conflict",
    [PublicDocumentsErrorCode.SourcesChanged]: "conflict",
    [PublicDocumentsErrorCode.StaleReview]: "conflict",
    [PublicDocumentsErrorCode.NoInternalRight]: "forbidden",
    [PublicDocumentsErrorCode.DraftUnavailable]: "unavailable",
    [PublicDocumentsErrorCode.NothingLeft]: "invalid",
}

/** The one error class of the public-documents capability. */
export class PublicDocumentsError extends DomainError<PublicDocumentsErrorCode> {}
