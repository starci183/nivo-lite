import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the loyalty ledger capability. */
export enum LoyaltyLedgerErrorCode {
    /** The workspace has no customer with the id. */
    CustomerNotFound = "LOYALTY_LEDGER_CUSTOMER_NOT_FOUND",
    /** Taking the points would leave the balance below zero. */
    InsufficientPoints = "LOYALTY_LEDGER_INSUFFICIENT_POINTS",
    /** The insert answered no row: the entry was not written. */
    NotPosted = "LOYALTY_LEDGER_NOT_POSTED",
}

/** How each loyalty ledger code travels. */
export const LOYALTY_LEDGER_ERROR_KINDS: Record<LoyaltyLedgerErrorCode, ErrorKind> = {
    [LoyaltyLedgerErrorCode.CustomerNotFound]: "not-found",
    [LoyaltyLedgerErrorCode.InsufficientPoints]: "conflict",
    [LoyaltyLedgerErrorCode.NotPosted]: "internal",
}

/** The one error class of the loyalty ledger capability. */
export class LoyaltyLedgerError extends DomainError<LoyaltyLedgerErrorCode> {}
