import type { ProviderRightsQuery, ProviderTemplateCandidatesQuery } from "@/modules/api"

/**
 * The shapes the provider-rights screens read, taken from the generated GraphQL types (backend F10:
 * lanes/UI-NEEDS-API-20261110.md). The wire sends `kind`, `scope` and `mode` as plain text; the screens narrow them below.
 */

/** The answer of `providerRights`. */
export type ProviderRightsWire = ProviderRightsQuery["providerRights"]

/** One provider of the shop with its abilities. */
export type ProviderWire = ProviderRightsWire["providers"][number]

/** One thing a provider lets an agent do. */
export type AbilityWire = ProviderWire["abilities"][number]

/** An ability an agent holds on a provider (an off ability is not listed). */
export type HeldAbilityWire = ProviderRightsWire["attachments"][number]["abilities"][number]

/** One row of `providerTemplateCandidates`: an agent that could get the provider by its template. */
export type TemplateCandidateWire = ProviderTemplateCandidatesQuery["providerTemplateCandidates"][number]

/** What a tick holds: off, by itself, or after the owner approves each use. A read ability is `off | auto`. */
export type AbilityMode = "off" | "auto" | "ask"

/** The mode of a tick that is on. */
export type OnMode = Exclude<AbilityMode, "off">

/** What a provider is for: it talks to customers, takes money, or keeps the books. */
export type ProviderGroupKind = "messaging" | "payment" | "books"

/** An attachment: a provider attached to an agent, with the abilities ticked. */
export type AttachmentWire = ProviderRightsWire["attachments"][number]

/** The `providerRights` input of `createAgentInstallation`: one provider with the abilities ticked. */
export interface CreateProviderRightsInput {
    readonly provider: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}
