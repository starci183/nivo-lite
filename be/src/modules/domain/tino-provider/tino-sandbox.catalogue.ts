import type { DomainPeriodPrice } from "@modules/domain/provider-registry"
import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"
import { TINO_PROVIDER } from "./tino-connection-fields.policy"

/**
 * THE FIXED DAY of the Tino sandbox catalogue (ruling R60: the same answer on every machine and every day, no clock): every expiry below
 * is written from it (`d.vn` is 30 days after it).
 */
export const TINO_SANDBOX_CATALOGUE_DATE = "2026-11-14"

/** The fixed price of one year of renewal at the sandbox Tino (VND): a receipt's total is the years times this. */
export const TINO_SANDBOX_RENEWAL_PRICE = 450_000

/** The prices a lookup quotes (Tino states them per period in its lookup answer). */
export const TINO_SANDBOX_PERIODS: ReadonlyArray<DomainPeriodPrice> = [
    { years: 1, register: 350_000, renew: TINO_SANDBOX_RENEWAL_PRICE, transfer: 350_000 },
    { years: 2, register: 700_000, renew: 2 * TINO_SANDBOX_RENEWAL_PRICE, transfer: 700_000 },
]

/** The operation the renewal cases answer in the sandbox call log and in the account's next-case selector. */
export const TINO_RENEW_OPERATION = "renew"

/** One domain the sandbox account holds: fixed data `find`, `details` and `list` answer from (no case is tied to a domain). */
export interface TinoSandboxDomain {
    /** The domain name (lower case). */
    readonly name: string
    /** Tino's own id of the domain (`providerId`). */
    readonly id: string
    /** The expiry before any renewal (`YYYY-MM-DD`), written from `TINO_SANDBOX_CATALOGUE_DATE`. */
    readonly expiresOn: string
}

/** The domains the sandbox account holds, in catalogue order (the order `list` pages). */
export const TINO_SANDBOX_DOMAINS: ReadonlyArray<TinoSandboxDomain> = [
    { name: "d.vn", id: "820001", expiresOn: "2026-12-14" },
    { name: "b.vn", id: "820002", expiresOn: "2026-11-24" },
    { name: "e.vn", id: "820003", expiresOn: "2026-11-17" },
    { name: "far2.vn", id: "820004", expiresOn: "2026-12-15" },
]

/** The nameservers every catalogue domain holds. */
export const TINO_SANDBOX_NAMESERVERS: ReadonlyArray<string> = ["ns1.tino.vn", "ns2.tino.vn"]

/** The catalogue domain of a name (case-insensitive), or null. */
export const tinoSandboxDomainOf = (name: string): TinoSandboxDomain | null =>
    TINO_SANDBOX_DOMAINS.find((domain) => domain.name === name.trim().toLowerCase()) ?? null

/** The ids of the renewal cases the implementation answers (the same ids as in `TINO_SANDBOX_CASES`). */
export const TINO_CASE = {
    renewed: "TINO-1",
    insufficientBalance: "TINO-2",
    pending: "TINO-3",
    locked: "TINO-4",
    alreadyRenewed: "TINO-5",
    appliedTimedOut: "TINO-6",
    flaky: "TINO-7",
    unreachable: "TINO-8",
    auth: "TINO-9",
    notFound: "TINO-10",
} as const

/**
 * The outbound cases of the Tino renewal (R62: the account's NEXT CASE picks one, sticky; `TINO-1` answers while nothing is picked).
 * The request never picks a case: every case answers any domain name. The business codes (`insufficient_balance`, `domain_locked`,
 * `domain_already_renewed`, `domain_not_held`) are the sandbox's own: Tino publishes none for them.
 */
export const TINO_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: TINO_CASE.renewed,
        label: "The domain renews: the expiry moves by the years, an invoice SBX-TINO-<n> (running per account) is answered",
        operation: TINO_RENEW_OPERATION,
        default: true,
    },
    {
        id: TINO_CASE.insufficientBalance,
        label: "The renew is refused for the account balance (the typed refusal insufficient_balance): nothing moves",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.pending,
        label: "The renew is accepted but not finished (an order number, no invoice or new expiry yet): the first read after it (the renewal's own proof read) still shows the old expiry, the SECOND read of the domain finds it renewed",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.locked,
        label: "The renew is refused because the domain is locked (the typed refusal domain_locked)",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.alreadyRenewed,
        label: "The renew is refused because it was already renewed at Tino (rejected, domain_already_renewed)",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.appliedTimedOut,
        label: "The renew is applied (the expiry moves) and then times out: unknown outcome, a read shows the new expiry",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.flaky,
        label: "The renew fails with a server error (5xx): nothing applied, the outcome is unknown",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.unreachable,
        label: "The renew times out and nothing is applied: unknown outcome, a read shows the old expiry",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.auth,
        label: "The renew is refused for the token at the gateway (401 invalid_token): nothing was sent",
        operation: TINO_RENEW_OPERATION,
    },
    {
        id: TINO_CASE.notFound,
        label: "The domain is not held by the account: the renew is refused rejected (domain_not_held)",
        operation: TINO_RENEW_OPERATION,
    },
]

/** The hardcoded catalogue of the Tino sandbox (R60, R62), registered at boot beside its implementation. */
export const TINO_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: TINO_PROVIDER,
    cases: TINO_SANDBOX_CASES,
}
