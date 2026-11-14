import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the NIVO data ops capability. */
export enum NivoApiErrorCode {
    /** An exposed op has no feature that declares it: the endpoint would answer it `not_exposed`. */
    OpsUncovered = "NIVO_API_OPS_UNCOVERED",
    /** An op is declared by more than one feature: which message it sends would be a guess. */
    OpsDuplicated = "NIVO_API_OPS_DUPLICATED",
}

/** How each NIVO data ops code travels. */
export const NIVO_API_ERROR_KINDS: Record<NivoApiErrorCode, ErrorKind> = {
    [NivoApiErrorCode.OpsUncovered]: "internal",
    [NivoApiErrorCode.OpsDuplicated]: "internal",
}

/** The one error class of the NIVO data ops capability. */
export class NivoApiError extends DomainError<NivoApiErrorCode> {}
