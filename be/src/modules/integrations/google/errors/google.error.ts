import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the google integration. */
export enum GoogleErrorCode {
    /** The OAuth client or the state key is not configured on this deployment. */
    NotConfigured = "GOOGLE_NOT_CONFIGURED",
    /** Google could not be reached, did not answer in time or answered with an unreadable body. */
    Unreachable = "GOOGLE_UNREACHABLE",
    /** Google answered with a refusal; the `status` and `reason` params carry what it said. */
    Refused = "GOOGLE_REFUSED",
    /** Google answered successfully but without the field the flow needs. */
    ContractMismatch = "GOOGLE_CONTRACT_MISMATCH",
    /** The sheet event names no spreadsheet to write to. */
    SheetMissing = "GOOGLE_SHEET_MISSING",
}

/** How each google code travels. */
export const GOOGLE_ERROR_KINDS: Record<GoogleErrorCode, ErrorKind> = {
    [GoogleErrorCode.NotConfigured]: "unavailable",
    [GoogleErrorCode.Unreachable]: "unavailable",
    [GoogleErrorCode.Refused]: "unavailable",
    [GoogleErrorCode.ContractMismatch]: "internal",
    [GoogleErrorCode.SheetMissing]: "invalid",
}

/** The one error class of the google integration. */
export class GoogleError extends DomainError<GoogleErrorCode> {}
