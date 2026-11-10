import type { ProviderRightsQuery, ProviderTemplateCandidatesQuery } from "@/modules/api"

/**
 * The shapes the provider-rights screens read, taken from the generated GraphQL types (backend F10:
 * lanes/UI-NEEDS-API-20261110.md). The wire sends `kind`, `scope` and `mode` as plain text; the screens narrow them below.
 */

/** The answer of `providerRights`. */
export type ProviderRightsWire = ProviderRightsQuery["providerRights"]

/** One provider of the shop with its abilities and its accounts. */
export type ProviderWire = ProviderRightsWire["providers"][number]

/** One connected account of a provider: where an agent is attached and ticks (the shop may connect two SePay accounts or two Zalo OAs). */
export type AccountWire = ProviderWire["accounts"][number]

/** One thing a provider lets an agent do. */
export type AbilityWire = ProviderWire["abilities"][number]

/** An ability an agent holds on a provider (an off ability is not listed). */
export type HeldAbilityWire = ProviderRightsWire["attachments"][number]["abilities"][number]

/** One row of `providerTemplateCandidates`: an agent that could get the account by its template. */
export type TemplateCandidateWire = ProviderTemplateCandidatesQuery["providerTemplateCandidates"][number]

/** What a tick holds: off, by itself, or after the owner approves each use. A read ability is `off | auto`. */
export type AbilityMode = "off" | "auto" | "ask"

/** The mode of a tick that is on. */
export type OnMode = Exclude<AbilityMode, "off">

/** What a provider is for: it talks to customers, takes money, or keeps the books. */
export type ProviderGroupKind = "messaging" | "payment" | "books"

/** An attachment: a connected account attached to an agent, with the abilities ticked. */
export type AttachmentWire = ProviderRightsWire["attachments"][number]

/** One account as a card shows it: the account, its provider (labels and ability list) and what is ticked on it. */
export interface HeldAccount {
    readonly provider: ProviderWire
    readonly account: AccountWire
    readonly held: ReadonlyArray<HeldAbilityWire>
}

/** The `providerRights` input of `createAgentInstallation`: one account with the abilities ticked. */
export interface CreateProviderRightsInput {
    readonly connectionId: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}
