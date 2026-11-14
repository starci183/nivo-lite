import { DomainError, type ErrorKind } from "@modules/platform/errors"

/**
 * Codes of the document readers, by WHY a reading could not go on: `LibraryMissing` (an optional library is not installed, so that
 * kind of file or page cannot be read on this machine; the package rides in `params.library`), `ConversionEmpty` (the HEIC decoder
 * answered no bytes), `NotWorkbook` / `NotPresentation` (the archive is an OOXML package of another kind).
 */
export enum DocumentReadersErrorCode {
    /** Choose when an optional library is not installed: nothing was read, and installing the package makes the same file readable. */
    LibraryMissing = "DOCUMENT_READERS_LIBRARY_MISSING",
    /** Choose when the HEIC decoder answered something that is not bytes: the photo cannot be turned into a JPEG. */
    ConversionEmpty = "DOCUMENT_READERS_CONVERSION_EMPTY",
    /** Choose when a file read as a workbook has no workbook part. */
    NotWorkbook = "DOCUMENT_READERS_NOT_WORKBOOK",
    /** Choose when a file read as a presentation has no presentation part. */
    NotPresentation = "DOCUMENT_READERS_NOT_PRESENTATION",
}

/** How each document-readers code travels. */
export const DOCUMENT_READERS_ERROR_KINDS: Record<DocumentReadersErrorCode, ErrorKind> = {
    [DocumentReadersErrorCode.LibraryMissing]: "unavailable",
    [DocumentReadersErrorCode.ConversionEmpty]: "unavailable",
    [DocumentReadersErrorCode.NotWorkbook]: "invalid",
    [DocumentReadersErrorCode.NotPresentation]: "invalid",
}

/** The one error class of the document readers. */
export class DocumentReadersError extends DomainError<DocumentReadersErrorCode> {}
