import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the provider-registry capability. */
export enum ProviderRegistryErrorCode {
    /**
     * The provider refused the connection itself (the permission was withdrawn, the scope was never given, the destination is not shared
     * with the account): only the owner can cure it, so it is never tried again. The provider rides in the params.
     */
    LedgerConnectionRefused = "PROVIDER_REGISTRY_LEDGER_CONNECTION_REFUSED",
}

/** How each provider-registry code travels. */
export const PROVIDER_REGISTRY_ERROR_KINDS: Record<ProviderRegistryErrorCode, ErrorKind> = {
    [ProviderRegistryErrorCode.LedgerConnectionRefused]: "forbidden",
}

/** The one error class of the provider-registry capability. */
export class ProviderRegistryError extends DomainError<ProviderRegistryErrorCode> {}
