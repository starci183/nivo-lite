import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the liveness capability. */
export enum LivenessErrorCode {
    /** A required dependency failed or did not answer within the deadline. */
    ReadinessUnavailable = "LIVENESS_READINESS_UNAVAILABLE",
}

/** How each liveness code travels. */
export const LIVENESS_ERROR_KINDS: Record<LivenessErrorCode, ErrorKind> = {
    [LivenessErrorCode.ReadinessUnavailable]: "unavailable",
}

/** The one error class of the liveness capability. */
export class LivenessError extends DomainError<LivenessErrorCode> {}
