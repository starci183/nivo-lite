import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the transactions capability. */
export enum TransactionsErrorCode {
    /** The insert answered no row: the payment record was not written. */
    NotCreated = "TRANSACTIONS_NOT_CREATED",
}

/** How each transactions code travels. */
export const TRANSACTIONS_ERROR_KINDS: Record<TransactionsErrorCode, ErrorKind> = {
    [TransactionsErrorCode.NotCreated]: "internal",
}

/** The one error class of the transactions capability. */
export class TransactionsError extends DomainError<TransactionsErrorCode> {}
