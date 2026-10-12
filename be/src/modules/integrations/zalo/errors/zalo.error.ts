import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the Zalo integration. */
export enum ZaloErrorCode {
    /** Zalo could not be reached or did not answer in time. */
    Unavailable = "ZALO_UNAVAILABLE",
    /** Zalo answered and refused the call; its numeric error rides in the params as `zaloCode` when it gave one. */
    Rejected = "ZALO_REJECTED",
    /** A webhook body was not the JSON its mac covers. */
    BodyUnreadable = "ZALO_BODY_UNREADABLE",
}

/** How each Zalo code travels. */
export const ZALO_ERROR_KINDS: Record<ZaloErrorCode, ErrorKind> = {
    [ZaloErrorCode.Unavailable]: "unavailable",
    [ZaloErrorCode.Rejected]: "unavailable",
    [ZaloErrorCode.BodyUnreadable]: "invalid",
}

/** The one error class of the Zalo integration. */
export class ZaloError extends DomainError<ZaloErrorCode> {}
