import type { SandboxCase, SandboxCatalogue } from "@modules/domain/provider-sandbox"
import { INET_PROVIDER } from "./inet-connection-fields.policy"

/**
 * THE FIXED DAY of the iNET sandbox catalogue (ruling R60: the same answer on every machine and every day, no clock): every expiry below
 * is written from it (`a.vn` is 30 days after it).
 */
export const INET_SANDBOX_CATALOGUE_DATE = "2026-11-14"

/** The fixed price of one year of renewal at the sandbox iNET (VND): a receipt's total is the years times this. */
export const INET_SANDBOX_RENEWAL_PRICE = 480_000

/** The operation the renewal cases answer in the sandbox call log and in the account's next-case selector. */
export const INET_RENEW_OPERATION = "renew"

/** One domain the sandbox account holds: fixed data `find`, `details` and `list` answer from (no case is tied to a domain). */
export interface InetSandboxDomain {
    /** The domain name (lower case). */
    readonly name: string
    /** iNET's own id of the domain (`providerId`). */
    readonly id: string
    /** The expiry before any renewal (`YYYY-MM-DD`), written from `INET_SANDBOX_CATALOGUE_DATE`. */
    readonly expiresOn: string
}

/** The domains the sandbox account holds, in catalogue order (the order `list` pages). */
export const INET_SANDBOX_DOMAINS: ReadonlyArray<InetSandboxDomain> = [
    { name: "a.vn", id: "710001", expiresOn: "2026-12-14" },
    { name: "a2.vn", id: "710002", expiresOn: "2026-11-24" },
    { name: "c.vn", id: "710003", expiresOn: "2026-11-17" },
    { name: "far.vn", id: "710004", expiresOn: "2026-12-15" },
]

/** The nameservers every catalogue domain holds. */
export const INET_SANDBOX_NAMESERVERS: ReadonlyArray<string> = ["ns1.inet.vn", "ns2.inet.vn"]

/** The catalogue domain of a name (case-insensitive), or null. */
export const inetSandboxDomainOf = (name: string): InetSandboxDomain | null =>
    INET_SANDBOX_DOMAINS.find((domain) => domain.name === name.trim().toLowerCase()) ?? null

/** The ids of the renewal cases the implementation answers (the same ids as in `INET_SANDBOX_CASES`). */
export const INET_CASE = {
    renewed: "INET-1",
    insufficientBalance: "INET-2",
    pending: "INET-3",
    locked: "INET-4",
    alreadyRenewed: "INET-5",
    appliedTimedOut: "INET-6",
    flaky: "INET-7",
    unreachable: "INET-8",
    auth: "INET-9",
    rate: "INET-10",
    portal: "INET-11",
    notFound: "INET-12",
} as const

/**
 * The outbound cases of the iNET renewal (R62: the account's NEXT CASE picks one, sticky; `INET-1` answers while nothing is picked).
 * The request never picks a case: every case answers any domain name.
 */
export const INET_SANDBOX_CASES: ReadonlyArray<SandboxCase> = [
    {
        id: INET_CASE.renewed,
        label: "The domain renews: the expiry moves by the years, an order SBX-INET-<n> (running per account) is answered",
        operation: INET_RENEW_OPERATION,
        default: true,
    },
    {
        id: INET_CASE.insufficientBalance,
        label: "The renew is refused for the reseller balance (the typed refusal insufficient_balance): nothing moves",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.pending,
        label: "The renew is accepted but not finished (order answered, no new expiry yet): the first read after it (the renewal's own proof read) still shows the old expiry, the SECOND read of the domain finds it renewed",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.locked,
        label: "The renew is refused because the domain is locked (the typed refusal domain_locked)",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.alreadyRenewed,
        label: "The renew is refused because it was already renewed at iNET (409, already_exists)",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.appliedTimedOut,
        label: "The renew is applied (the expiry moves) and then times out: unknown outcome, a read shows the new expiry",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.flaky,
        label: "The renew fails with a server error (5xx): nothing applied, the outcome is unknown",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.unreachable,
        label: "The renew times out and nothing is applied: unknown outcome, a read shows the old expiry",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.auth,
        label: "The renew is refused for the key at the gateway (401): nothing was sent",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.rate,
        label: "The renew is refused for the rate (429): nothing was sent, retry after 30 seconds",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.portal,
        label: "The account is of the portal family (api_context not reseller): the renew is refused not_available (portal renewal undocumented)",
        operation: INET_RENEW_OPERATION,
    },
    {
        id: INET_CASE.notFound,
        label: "The domain is not held by the account: the renew is refused not_found",
        operation: INET_RENEW_OPERATION,
    },
]

/** The hardcoded catalogue of the iNET sandbox (R60, R62), registered at boot beside its implementation. */
export const INET_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: INET_PROVIDER,
    cases: INET_SANDBOX_CASES,
}
