import { DocumentReadersError, DocumentReadersErrorCode } from "./errors/document-readers.error"

/** Whether a failure is the refusal for an optional library that is not installed. */
export const isLibraryMissing = (cause: unknown): boolean =>
    cause instanceof DocumentReadersError && cause.code === DocumentReadersErrorCode.LibraryMissing
