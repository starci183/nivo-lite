import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the accounting capability. */
export enum AccountingErrorCode {
    /** The approval item does not carry the receivable payment to record. */
    PaymentInvalid = "ACCOUNTING_PAYMENT_INVALID",
    /** The connector did not record the approved payment. */
    PaymentNotRecorded = "ACCOUNTING_PAYMENT_NOT_RECORDED",
}

/** How each accounting code travels. */
export const ACCOUNTING_ERROR_KINDS: Record<AccountingErrorCode, ErrorKind> = {
    [AccountingErrorCode.PaymentInvalid]: "invalid",
    [AccountingErrorCode.PaymentNotRecorded]: "unavailable",
}

/** The one error class of the accounting capability. */
export class AccountingError extends DomainError<AccountingErrorCode> {}
