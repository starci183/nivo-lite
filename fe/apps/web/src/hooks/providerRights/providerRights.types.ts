/**
 * The wire shapes of the provider-rights API as backend F10 fixed them (docs: lanes/UI-NEEDS-API-20261110.md, "Backend F10: state at the
 * safe stop", and lanes/ABILITIES-20261110.md). GraphQL is not exposed yet: the `fake*.ts` sources of this folder answer these shapes,
 * and the swap to the real operations changes ONE file per source.
 */

/** Words in both reader languages, as the back end sends them. */
export interface LocalizedWire {
    readonly vi: string
    readonly en: string
}

/** What a provider is for: it talks to customers, takes money, or keeps the books. */
export type ProviderKind = "messaging" | "payment" | "books"

/** A read ability looks at things; a write one changes something outside NIVO. */
export type AbilityScope = "read" | "write"

/** What a tick holds: off, by itself, or after the owner approves each use. A read ability is `off | auto`. */
export type AbilityMode = "off" | "auto" | "ask"

/** The mode of a tick that is on. */
export type OnMode = Exclude<AbilityMode, "off">

/** One thing a provider lets an agent do. */
export interface AbilityWire {
    readonly id: string
    readonly label: LocalizedWire
    readonly scope: AbilityScope
    readonly tools: ReadonlyArray<string>
}

/** One provider of the shop (its key is the provider, e.g. `zalo_oa`). */
export interface ProviderWire {
    readonly provider: string
    readonly label: LocalizedWire
    readonly kind: ProviderKind
    readonly kindLabel: LocalizedWire
    /** The shop holds a working connection for it. */
    readonly connected: boolean
    readonly abilities: ReadonlyArray<AbilityWire>
}

/** An ability an agent holds on a provider (an off ability is not listed). */
export interface HeldAbilityWire {
    readonly id: string
    readonly mode: OnMode
}

/** A provider attached to an agent, with the abilities ticked. */
export interface AttachmentWire {
    readonly agentId: string
    readonly provider: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}

/** The answer of `providerRights`. */
export interface ProviderRightsWire {
    readonly providers: ReadonlyArray<ProviderWire>
    readonly attachments: ReadonlyArray<AttachmentWire>
}

/** One row of `agentAbilityProposal({ moduleKey })`: a connected provider the template names, with its ticks. */
export interface AbilityProposalWire {
    readonly provider: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}

/** One row of `providerTemplateCandidates({ provider })`: an agent that could get the provider by template. */
export interface TemplateCandidateWire {
    readonly agentId: string
    readonly agentName: string
    readonly module: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}

/** The `providerRights` input of `createAgent` (not built yet). */
export interface CreateProviderRightsInput {
    readonly provider: string
    readonly abilities: ReadonlyArray<HeldAbilityWire>
}
