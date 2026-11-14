import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the provider-sandbox capability (lane concept provider-sandbox). */
export enum ProviderSandboxErrorCode {
    /** The sandbox is switched off (production, ruling R60): no sandbox account opens, none is answered, no sandbox key is taken. */
    Off = "PROVIDER_SANDBOX_OFF",
    /** A sandbox door (state, the call log, the catalogue's webhook) was asked about a LIVE account: it never touches one. */
    LiveAccount = "PROVIDER_SANDBOX_LIVE_ACCOUNT",
    /** The workspace has no such account, or it was removed (R36). */
    AccountNotFound = "PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND",
    /** A webhook call for a sandbox account did not present that account's sandbox key. */
    WebhookKeyRefused = "PROVIDER_SANDBOX_WEBHOOK_KEY_REFUSED",
    /** The provider has no hardcoded case of that id. */
    CaseUnknown = "PROVIDER_SANDBOX_CASE_UNKNOWN",
    /** An inbound case was sent without an input it takes, or with one of the wrong kind (R62: `{ content, amount }`). */
    InputInvalid = "PROVIDER_SANDBOX_INPUT_INVALID",
    /** "Expire this run's wait now" found the run not parked at a wait, or its wait already taken (`runId`, `reason`). */
    RunNotWaiting = "PROVIDER_SANDBOX_RUN_NOT_WAITING",
    /** A sandbox account was asked for a provider that ships no sandbox (`provider`). */
    ProviderUnknown = "PROVIDER_SANDBOX_PROVIDER_UNKNOWN",
}

/** How each provider-sandbox code travels. */
export const PROVIDER_SANDBOX_ERROR_KINDS: Record<ProviderSandboxErrorCode, ErrorKind> = {
    [ProviderSandboxErrorCode.LiveAccount]: "forbidden",
    [ProviderSandboxErrorCode.AccountNotFound]: "not-found",
    [ProviderSandboxErrorCode.WebhookKeyRefused]: "unauthenticated",
    [ProviderSandboxErrorCode.CaseUnknown]: "not-found",
    [ProviderSandboxErrorCode.Off]: "forbidden",
    [ProviderSandboxErrorCode.InputInvalid]: "invalid",
    [ProviderSandboxErrorCode.RunNotWaiting]: "conflict",
    [ProviderSandboxErrorCode.ProviderUnknown]: "invalid",
}

/** The one error class of the provider-sandbox capability. */
export class ProviderSandboxError extends DomainError<ProviderSandboxErrorCode> {}
