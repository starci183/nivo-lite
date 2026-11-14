import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the liveness capability. */
export enum LivenessErrorCode {
    /** A required dependency failed or did not answer within the deadline. */
    ReadinessUnavailable = "LIVENESS_READINESS_UNAVAILABLE",
    /** The vector index (a required engine piece, the only home of vectors) did not answer: the process is not ready. */
    VectorIndexDown = "LIVENESS_VECTOR_INDEX_DOWN",
}

/** How each liveness code travels. */
export const LIVENESS_ERROR_KINDS: Record<LivenessErrorCode, ErrorKind> = {
    [LivenessErrorCode.ReadinessUnavailable]: "unavailable",
    [LivenessErrorCode.VectorIndexDown]: "unavailable",
}

/** The one error class of the liveness capability. */
export class LivenessError extends DomainError<LivenessErrorCode> {}
