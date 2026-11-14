import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the provider-registry capability. */
export enum ProviderRegistryErrorCode {
    /**
     * The provider refused the connection itself (the permission was withdrawn, the scope was never given, the destination is not shared
     * with the account): only the owner can cure it, so it is never tried again. The provider rides in the params.
     */
    LedgerConnectionRefused = "PROVIDER_REGISTRY_LEDGER_CONNECTION_REFUSED",
    /** A provider refused the request's content (a validation error); no effect. The provider and its words ride in the params. */
    RefusedRejected = "PROVIDER_REGISTRY_REFUSED_REJECTED",
    /** The voice, job, file or record is not there; no effect. */
    RefusedNotFound = "PROVIDER_REGISTRY_REFUSED_NOT_FOUND",
    /** A provider refused the account's credential; no effect. */
    RefusedAuth = "PROVIDER_REGISTRY_REFUSED_AUTH",
    /** The account holds no credential, so nothing was sent. */
    RefusedNoCredential = "PROVIDER_REGISTRY_REFUSED_NO_CREDENTIAL",
    /** The operation is not built (its documentation could not be read), so nothing was sent. */
    RefusedNotAvailable = "PROVIDER_REGISTRY_REFUSED_NOT_AVAILABLE",
    /** A registrar refused the domain operation: the operation is not built for it. */
    DomainNotAvailable = "PROVIDER_REGISTRY_DOMAIN_NOT_AVAILABLE",
    /** A registrar answered that the domain, record or contact is not there. */
    DomainNotFound = "PROVIDER_REGISTRY_DOMAIN_NOT_FOUND",
    /** A registrar answered that the domain or record already exists. */
    DomainAlreadyExists = "PROVIDER_REGISTRY_DOMAIN_ALREADY_EXISTS",
    /** A registrar refused the request's content. */
    DomainRejected = "PROVIDER_REGISTRY_DOMAIN_REJECTED",
    /** The registration needs contact data the request did not carry. */
    DomainContactsRequired = "PROVIDER_REGISTRY_DOMAIN_CONTACTS_REQUIRED",
    /** The registrar takes no contact data on a registration. */
    DomainContactsUnsupported = "PROVIDER_REGISTRY_DOMAIN_CONTACTS_UNSUPPORTED",
    /** A provider call failed and the request never left (no account, no token, a refusal at the gateway). */
    CallNotSent = "PROVIDER_REGISTRY_CALL_NOT_SENT",
    /** A provider call failed after the request may have reached the provider (a timeout, a broken connection): the effect is not known. */
    CallUnknown = "PROVIDER_REGISTRY_CALL_UNKNOWN",
}

/** How each provider-registry code travels. */
export const PROVIDER_REGISTRY_ERROR_KINDS: Record<ProviderRegistryErrorCode, ErrorKind> = {
    [ProviderRegistryErrorCode.LedgerConnectionRefused]: "forbidden",
    [ProviderRegistryErrorCode.RefusedRejected]: "invalid",
    [ProviderRegistryErrorCode.RefusedNotFound]: "not-found",
    [ProviderRegistryErrorCode.RefusedAuth]: "forbidden",
    [ProviderRegistryErrorCode.RefusedNoCredential]: "conflict",
    [ProviderRegistryErrorCode.RefusedNotAvailable]: "unavailable",
    [ProviderRegistryErrorCode.DomainNotAvailable]: "unavailable",
    [ProviderRegistryErrorCode.DomainNotFound]: "not-found",
    [ProviderRegistryErrorCode.DomainAlreadyExists]: "conflict",
    [ProviderRegistryErrorCode.DomainRejected]: "invalid",
    [ProviderRegistryErrorCode.DomainContactsRequired]: "invalid",
    [ProviderRegistryErrorCode.DomainContactsUnsupported]: "invalid",
    [ProviderRegistryErrorCode.CallNotSent]: "unavailable",
    [ProviderRegistryErrorCode.CallUnknown]: "unavailable",
}

/** The one error class of the provider-registry capability. */
export class ProviderRegistryError extends DomainError<ProviderRegistryErrorCode> {}
