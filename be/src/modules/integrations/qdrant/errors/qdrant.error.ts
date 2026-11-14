import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the Qdrant integration. */
export enum QdrantErrorCode {
    /** The service could not be reached or did not answer in time. */
    Unavailable = "QDRANT_UNAVAILABLE",
    /** The service answered and refused the call (`call`, `status`). */
    Rejected = "QDRANT_REJECTED",
    /** A collection exists with another vector size or distance than the app embeds with (`collection`, `expected`, `found`). */
    Mismatch = "QDRANT_MISMATCH",
}

/** How each Qdrant code travels. */
export const QDRANT_ERROR_KINDS: Record<QdrantErrorCode, ErrorKind> = {
    [QdrantErrorCode.Unavailable]: "unavailable",
    [QdrantErrorCode.Rejected]: "unavailable",
    [QdrantErrorCode.Mismatch]: "internal",
}

/** The one error class of the Qdrant integration. */
export class QdrantError extends DomainError<QdrantErrorCode> {}
