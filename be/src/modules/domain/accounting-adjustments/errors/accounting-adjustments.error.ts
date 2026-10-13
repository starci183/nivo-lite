import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** The correction failure codes. */
export enum AccountingAdjustmentsErrorCode {
    /** The target does not belong to this workspace. */
    NotFound = "ACCOUNTING_ADJUSTMENTS_NOT_FOUND",
    /** The correction has an invalid target, note or amount. */
    Invalid = "ACCOUNTING_ADJUSTMENTS_INVALID",
    /** Persistence did not append the correction. */
    NotCreated = "ACCOUNTING_ADJUSTMENTS_NOT_CREATED",
}
/** How correction errors travel over the API. */
export const ACCOUNTING_ADJUSTMENTS_ERROR_KINDS: Record<AccountingAdjustmentsErrorCode, ErrorKind> = {
    [AccountingAdjustmentsErrorCode.NotFound]: "not-found",
    [AccountingAdjustmentsErrorCode.Invalid]: "invalid",
    [AccountingAdjustmentsErrorCode.NotCreated]: "internal",
}
/** The correction capability's typed error. */
export class AccountingAdjustmentsError extends DomainError<AccountingAdjustmentsErrorCode> {}
