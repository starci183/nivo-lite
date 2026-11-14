import type { DomainRefusalReason } from "../domain-ports.contracts"
import type { ProviderRefusalReason } from "../media-ports.contracts"
import type { ProviderCallProof } from "../provider-call-failure"
import { ProviderRegistryError, ProviderRegistryErrorCode } from "./provider-registry.error"

const REFUSAL_CODE: Readonly<Record<ProviderRefusalReason, ProviderRegistryErrorCode>> = {
    rejected: ProviderRegistryErrorCode.RefusedRejected,
    not_found: ProviderRegistryErrorCode.RefusedNotFound,
    auth_refused: ProviderRegistryErrorCode.RefusedAuth,
    no_credential: ProviderRegistryErrorCode.RefusedNoCredential,
    not_available: ProviderRegistryErrorCode.RefusedNotAvailable,
}

const DOMAIN_CODE: Readonly<Record<DomainRefusalReason, ProviderRegistryErrorCode>> = {
    not_available: ProviderRegistryErrorCode.DomainNotAvailable,
    not_found: ProviderRegistryErrorCode.DomainNotFound,
    already_exists: ProviderRegistryErrorCode.DomainAlreadyExists,
    rejected: ProviderRegistryErrorCode.DomainRejected,
    contacts_required: ProviderRegistryErrorCode.DomainContactsRequired,
    contacts_unsupported: ProviderRegistryErrorCode.DomainContactsUnsupported,
    insufficient_balance: ProviderRegistryErrorCode.DomainInsufficientBalance,
    domain_locked: ProviderRegistryErrorCode.DomainLocked,
}

const CALL_CODE: Readonly<Record<ProviderCallProof, ProviderRegistryErrorCode>> = {
    not_sent: ProviderRegistryErrorCode.CallNotSent,
    unknown: ProviderRegistryErrorCode.CallUnknown,
}

const REFUSAL_REASONS: ReadonlyArray<ProviderRefusalReason> = ["rejected", "not_found", "auth_refused", "no_credential", "not_available"]
const DOMAIN_REASONS: ReadonlyArray<DomainRefusalReason> = [
    "not_available",
    "not_found",
    "already_exists",
    "rejected",
    "contacts_required",
    "contacts_unsupported",
    "insufficient_balance",
    "domain_locked",
]
const PROOFS: ReadonlyArray<ProviderCallProof> = ["not_sent", "unknown"]

const reasonOfCode = <R extends string>(
    reasons: ReadonlyArray<R>,
    table: Readonly<Record<R, ProviderRegistryErrorCode>>,
    code: string,
): R | null => reasons.find((reason) => table[reason] === code) ?? null

/** The refusal a provider adapter throws for an answer that proves no effect; the provider's words ride in `detail`. */
export const providerRefusal = (
    provider: string,
    reason: ProviderRefusalReason,
    detail: string | null = null,
    cause?: unknown,
): ProviderRegistryError =>
    new ProviderRegistryError({
        code: REFUSAL_CODE[reason],
        params: detail === null ? { provider } : { provider, detail },
        ...(cause === undefined ? {} : { cause }),
    })

/** Why a provider refused, or null when the failure is no provider refusal. */
export const providerRefusalReason = (cause: unknown): ProviderRefusalReason | null =>
    cause instanceof ProviderRegistryError ? reasonOfCode(REFUSAL_REASONS, REFUSAL_CODE, cause.code) : null

/** The provider's words of a provider refusal, or null when it said none (or the failure is no provider refusal). */
export const providerRefusalDetail = (cause: unknown): string | null => {
    if (providerRefusalReason(cause) === null || !(cause instanceof ProviderRegistryError)) return null
    const detail = cause.params.detail
    return typeof detail === "string" ? detail : null
}

/** The refusal of a domain operation: an ANSWER about the request (the provider did nothing), never a failure of the provider. */
export const registrarRefusal = (reason: DomainRefusalReason, providerCode: string | null = null, cause?: unknown): ProviderRegistryError =>
    new ProviderRegistryError({
        code: DOMAIN_CODE[reason],
        params: providerCode === null ? {} : { providerCode },
        ...(cause === undefined ? {} : { cause }),
    })

/** Why a registrar refused a domain operation, or null when the failure is no registrar refusal. */
export const registrarRefusalReason = (cause: unknown): DomainRefusalReason | null =>
    cause instanceof ProviderRegistryError ? reasonOfCode(DOMAIN_REASONS, DOMAIN_CODE, cause.code) : null

/** The failure of one provider call with what it proves about its effect; the tool runner reads the proof alone. */
export const providerCallFailure = (proof: ProviderCallProof, cause?: unknown): ProviderRegistryError =>
    new ProviderRegistryError({ code: CALL_CODE[proof], ...(cause === undefined ? {} : { cause }) })

/** What a failure typed by `providerCallFailure` proves, or null for any other failure. */
export const callProofOf = (cause: unknown): ProviderCallProof | null =>
    cause instanceof ProviderRegistryError ? reasonOfCode(PROOFS, CALL_CODE, cause.code) : null

/** The failure a `providerCallFailure` wraps, or the failure itself when it is no such wrapper. */
export const providerCallCause = (cause: unknown): unknown => (callProofOf(cause) !== null && cause instanceof Error ? cause.cause : cause)
