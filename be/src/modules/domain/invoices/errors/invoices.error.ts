import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the invoices capability. */
export enum InvoicesErrorCode {
    /** No free invoice number was found after several attempts. */
    NotNumbered = "INVOICES_NOT_NUMBERED",
    /** The invoice to pay is not in the workspace. */
    NotFound = "INVOICES_NOT_FOUND",
}

/** How each invoices code travels. */
export const INVOICES_ERROR_KINDS: Record<InvoicesErrorCode, ErrorKind> = {
    [InvoicesErrorCode.NotNumbered]: "internal",
    [InvoicesErrorCode.NotFound]: "not-found",
}

/** The one error class of the invoices capability. */
export class InvoicesError extends DomainError<InvoicesErrorCode> {}
