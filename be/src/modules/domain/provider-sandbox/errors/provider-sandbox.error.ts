import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the provider-sandbox capability (lane concept provider-sandbox). */
export enum ProviderSandboxErrorCode {
    /** A sandbox door (fixtures, scripts, the call log) was asked about a LIVE account: it never touches one. */
    LiveAccount = "PROVIDER_SANDBOX_LIVE_ACCOUNT",
    /** The workspace has no such account, or it was removed (R36). */
    AccountNotFound = "PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND",
    /** A webhook call for a sandbox account did not present that account's sandbox key. */
    WebhookKeyRefused = "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED",
    /** A fixture or script is not usable: an empty operation, a `refused` failure with no reason, a count that is no positive whole number. */
    EntryInvalid = "PROVIDER_SANDBOX_ENTRY_INVALID",
}

/** How each provider-sandbox code travels. */
export const PROVIDER_SANDBOX_ERROR_KINDS: Record<ProviderSandboxErrorCode, ErrorKind> = {
    [ProviderSandboxErrorCode.LiveAccount]: "forbidden",
    [ProviderSandboxErrorCode.AccountNotFound]: "not-found",
    [ProviderSandboxErrorCode.WebhookKeyRefused]: "unauthenticated",
    [ProviderSandboxErrorCode.EntryInvalid]: "invalid",
}

/** The one error class of the provider-sandbox capability. */
export class ProviderSandboxError extends DomainError<ProviderSandboxErrorCode> {}
