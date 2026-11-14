import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the MISA meInvoice integration. */
export enum MisaMeinvoiceErrorCode {
    /**
     * The operation is not built: its official documentation could not be read (`misa-meinvoice.operations.ts` says what was searched), so
     * no request is ever sent. The operation's level-1 name rides in the params.
     */
    NotAvailable = "MISA_MEINVOICE_NOT_AVAILABLE",
}

/** How each MISA meInvoice code travels. */
export const MISA_MEINVOICE_ERROR_KINDS: Record<MisaMeinvoiceErrorCode, ErrorKind> = {
    [MisaMeinvoiceErrorCode.NotAvailable]: "unavailable",
}

/** The one error class of the MISA meInvoice integration. */
export class MisaMeinvoiceError extends DomainError<MisaMeinvoiceErrorCode> {}
