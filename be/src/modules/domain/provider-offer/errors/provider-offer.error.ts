import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the provider offer read. */
export enum ProviderOfferErrorCode {
    /** The workspace has no connected account with that id. */
    ConnectionNotFound = "PROVIDER_OFFER_CONNECTION_NOT_FOUND",
}

/** How each provider offer code travels. */
export const PROVIDER_OFFER_ERROR_KINDS: Record<ProviderOfferErrorCode, ErrorKind> = {
    [ProviderOfferErrorCode.ConnectionNotFound]: "not-found",
}

/** The one error class of the provider offer capability. */
export class ProviderOfferError extends DomainError<ProviderOfferErrorCode> {}
