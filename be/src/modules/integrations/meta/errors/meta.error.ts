import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the meta integration. */
export enum MetaErrorCode {
    /** The Meta app or the state key is not configured on this deployment. */
    NotConfigured = "META_NOT_CONFIGURED",
    /** Meta could not be reached, did not answer in time or answered with an unreadable body. */
    Unreachable = "META_UNREACHABLE",
    /** Meta answered with a Graph error; the `failure` param is its classification. */
    Refused = "META_REFUSED",
    /** Meta answered successfully but without the field the flow needs. */
    ContractMismatch = "META_CONTRACT_MISMATCH",
}

/** How each meta code travels. */
export const META_ERROR_KINDS: Record<MetaErrorCode, ErrorKind> = {
    [MetaErrorCode.NotConfigured]: "unavailable",
    [MetaErrorCode.Unreachable]: "unavailable",
    [MetaErrorCode.Refused]: "unavailable",
    [MetaErrorCode.ContractMismatch]: "internal",
}

/** The one error class of the meta integration. */
export class MetaError extends DomainError<MetaErrorCode> {}
