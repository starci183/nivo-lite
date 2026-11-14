import type { ProviderRightsQuery, ProviderTemplateCandidatesQuery } from "@/modules/api"

/**
 * The shapes the provider-rights screens read, taken from the generated GraphQL types (backend F10:
 * lanes/UI-NEEDS-API-20261110.md). The wire sends `kind`, `scope` and `mode` as plain text; the screens narrow them below.
 */

/** The answer of `providerRights`. */
export type ProviderRightsWire = ProviderRightsQuery["providerRights"]

/** One provider of the shop with the tools it serves and its accounts. */
export type ProviderWire = ProviderRightsWire["providers"][number]

/** One connected account of a provider: where an agent is attached and ticks (the shop may connect two SePay accounts or two Zalo OAs). */
export type AccountWire = ProviderWire["accounts"][number]

/** One row of `providerTemplateCandidates`: an agent that could get the account by its template. */
export type TemplateCandidateWire = ProviderTemplateCandidatesQuery["providerTemplateCandidates"][number]

/** What a provider is for: it talks to customers, sends email, takes money, or keeps the books. */
export type ProviderGroupKind = "messaging" | "mail" | "payment" | "books"

/** One account as a card shows it: the account and its provider (labels and tools). */
export interface HeldAccount {
    readonly provider: ProviderWire
    readonly account: AccountWire
}

/** The `providerRights` input of `createAgentInstallation`: one account the new agent is attached to. */
export interface CreateProviderRightsInput {
    readonly connectionId: string
}
