import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import type { AbilityLabel } from "./messages/provider-abilities.labels"
import type { ProviderKind } from "./provider-abilities.policy"

/** One group of the tools a provider serves, as the console draws it (information: which provider serves which tool). */
export interface AbilityView {
    /** The group id. */
    readonly id: string
    /** Its name in business words. */
    readonly label: AbilityLabel
    /** `read` or `write` (display only). */
    readonly scope: "read" | "write"
    /** The tools it holds. */
    readonly tools: ReadonlyArray<string>
}

/** One connected account of a provider: the thing an agent is attached to. */
export interface AccountView {
    /** The connection. */
    readonly connectionId: string
    /** The provider it is an account of. */
    readonly provider: string
    /** The name of the connection (the account it reaches). */
    readonly label: string
    /** True when the connection works: only then can an agent be attached to it. */
    readonly connected: boolean
}

/** One provider as the console draws it: the tools it serves once, and the workspace's accounts of it. */
export interface ProviderView {
    /** The provider key. */
    readonly provider: string
    /** Its name. */
    readonly label: AbilityLabel
    /** Its kind (a display category). */
    readonly kind: ProviderKind
    /** The name of its kind. */
    readonly kindLabel: AbilityLabel
    /** True when the workspace holds at least one working account of it. */
    readonly connected: boolean
    /** The groups of tools it serves; none means no agent can be attached to an account of it yet. */
    readonly abilities: ReadonlyArray<AbilityView>
    /** The workspace's accounts of it, oldest first. */
    readonly accounts: ReadonlyArray<AccountView>
}

/** The accounts of a workspace's agents: the providers with the tools they serve and their accounts, and every attachment. */
export interface ProviderBoard {
    /** Every provider of the catalogue. */
    readonly providers: ReadonlyArray<ProviderView>
    /** Every attachment of the workspace. */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
}

/** One attachment to store: an agent's attachment to a connected account. */
export interface ProposedAttachment {
    /** The connected account. */
    readonly connectionId: string
    /** The provider of that account. */
    readonly provider: string
}

/**
 * One line of a module's proposal for a fresh agent: a working account of a provider its template agent lists, or a listed provider the
 * workspace has not connected (no account: it is only named).
 */
export interface TemplateProposal {
    /** The provider. */
    readonly provider: string
    /** The connected account, or null for a provider that is not connected. */
    readonly connectionId: string | null
    /** The name of the account, or null. */
    readonly accountLabel: string | null
    /** True for a working account. */
    readonly connected: boolean
}

/** One attachment a person asks for: a connected account. */
export interface AttachmentWish {
    /** The connected account. */
    readonly connectionId: string
}

/** An agent a template would attach to an account. */
export interface TemplateCandidate {
    /** The agent. */
    readonly agentId: string
    /** Its name. */
    readonly agentName: string
    /** Its module. */
    readonly module: string
}

/** Why a change of an attachment was not made. */
export type AttachmentRefusal =
    | "unknown_account"
    | "no_ability"
    | "not_connected"
    | "unknown_agent"
    | "already_attached"
    | "not_attached"

/** What a change of an attachment came to. */
export type AttachmentChangeResult = { readonly ok: true } | { readonly ok: false; readonly reason: AttachmentRefusal }
