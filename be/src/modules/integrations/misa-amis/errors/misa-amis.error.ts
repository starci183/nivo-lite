import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the MISA AMIS integration. */
export enum MisaAmisErrorCode {
    /**
     * The operation is not built: its official documentation could not be read (`misa-amis.operations.ts` says what was searched), so
     * no request is ever sent. The operation's level-1 name rides in the params.
     */
    NotAvailable = "MISA_AMIS_NOT_AVAILABLE",
}

/** How each MISA AMIS code travels. */
export const MISA_AMIS_ERROR_KINDS: Record<MisaAmisErrorCode, ErrorKind> = {
    [MisaAmisErrorCode.NotAvailable]: "unavailable",
}

/** The one error class of the MISA AMIS integration. */
export class MisaAmisError extends DomainError<MisaAmisErrorCode> {}
