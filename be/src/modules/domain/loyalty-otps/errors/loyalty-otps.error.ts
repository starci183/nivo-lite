import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the loyalty one-time codes capability. */
export enum LoyaltyOtpsErrorCode {
    /** The insert answered no row: the code was not stored. */
    NotIssued = "LOYALTY_OTPS_NOT_ISSUED",
}

/** How each loyalty one-time codes code travels. */
export const LOYALTY_OTPS_ERROR_KINDS: Record<LoyaltyOtpsErrorCode, ErrorKind> = {
    [LoyaltyOtpsErrorCode.NotIssued]: "internal",
}

/** The one error class of the loyalty one-time codes capability. */
export class LoyaltyOtpsError extends DomainError<LoyaltyOtpsErrorCode> {}
