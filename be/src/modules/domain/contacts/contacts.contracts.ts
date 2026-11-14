import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** The kinds of identity a contact holds: a phone, a mail address, a channel's own user id, an outside system's customer id. */
export type IdentityKind = "phone" | "email" | "channel" | "external"

/**
 * How an identity is proven: the channel vouches for its own user id (`channel`), the person presented a one-time link token (`token`),
 * a person decided (`member`: on the contacts page, or by approving a step's call). No other proof exists.
 */
export type IdentityProof = "channel" | "token" | "member"

/** Where an identity was learned: a channel's message, a workflow step, a person on the page, a form the person filled. */
export type IdentitySource = "channel" | "step" | "member" | "form"

/** Why two contacts became one: an exact verified phone, an exact verified mail, a link token, or a person approved it. */
export type MergeReason = "phone_verified" | "email_verified" | "link_token" | "member_approved"

/** Where a contact stands: a person, a tombstone merged into another, a tombstone deleted (softly: nothing is removed, every read leaves it out) on a person's decision. */
export type ContactState = "active" | "merged" | "erased"

/** An identity as a caller gives it, before normalisation. */
export interface IdentityInput {
    /** The kind. */
    readonly kind: IdentityKind
    /** The channel of a channel id (`zalo`, `telegram`, `facebook`, `instagram`, `website`); absent for the other kinds. */
    readonly provider?: string | undefined
    /** The account (connection) of a channel id or an outside customer; absent for a phone or a mail. */
    readonly account?: string | undefined
    /** The value as given. */
    readonly value: string
    /** The proof that comes with it; absent for a self-declared identity (a claim). */
    readonly proof?: IdentityProof | undefined
}

/** An identity in its one canonical form: what the store keys, compares and keeps. */
export interface IdentityKey {
    /** The kind. */
    readonly kind: IdentityKind
    /** The channel of a channel id; empty for the other kinds. */
    readonly provider: string
    /** The account of a channel id or an outside customer; empty for a phone or a mail. */
    readonly account: string
    /** The normalised value. */
    readonly value: string
}

/** A normalised identity with its proof: verified exactly when a proof comes with it. */
export interface NormalIdentity extends IdentityKey {
    /** The proof; null for a claim. */
    readonly proof: IdentityProof | null
}

/** One identity a contact holds, as the store keeps it. */
export interface ContactIdentity extends IdentityKey {
    /** The identity's row id. */
    readonly id: string
    /** The contact. */
    readonly contactId: string
    /** Whether it is proven. */
    readonly verified: boolean
    /** How it is proven; null for a claim. */
    readonly verifiedBy: IdentityProof | null
    /** Where it was learned. */
    readonly source: IdentitySource
    /** Why it came to this contact by a merge; null for an identity the contact was met with. */
    readonly joinedBy: MergeReason | null
    /** When it was added, ISO UTC. */
    readonly at: string
}

/** One contact as the store keeps it. */
export interface Contact {
    /** The id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The name the person is shown by; null when nobody knows it yet. */
    readonly displayName: string | null
    /** Generic labels. */
    readonly tags: ReadonlyArray<string>
    /** Where it stands. */
    readonly state: ContactState
    /** When it was met, ISO UTC. */
    readonly createdAt: string
    /** When it last changed, ISO UTC. */
    readonly updatedAt: string
}

/** A contact with the identities it holds. */
export interface ContactWithIdentities extends Contact {
    /** Its identities, oldest first. */
    readonly identities: ReadonlyArray<ContactIdentity>
}

/** An identity some contact of the workspace holds, found by an exact lookup of the normalised key. */
export interface IdentityMatch {
    /** The identity. */
    readonly key: IdentityKey
    /** The contact that holds it. */
    readonly contactId: string
    /** The workspace of that contact. */
    readonly workspaceId: string
    /** Whether the contact holds it proven. */
    readonly verified: boolean
    /** When that contact was met, ISO UTC: the older contact survives a merge. */
    readonly contactCreatedAt: string
}

/** The contact a valid one-time link token was issued for: presenting it proves the person is that contact. */
export interface TokenContact {
    /** The contact. */
    readonly contactId: string
    /** Its workspace. */
    readonly workspaceId: string
    /** When it was met, ISO UTC. */
    readonly createdAt: string
}

/** What resolving an incoming person reads: the incoming identities and what the store found for them by exact lookups. */
export interface ResolveInput {
    /** The identities the person comes with, normalised. */
    readonly incoming: ReadonlyArray<NormalIdentity>
    /** The identities some contact holds that equal an incoming one, exactly. */
    readonly matches: ReadonlyArray<IdentityMatch>
    /** The contacts whose display name equals the incoming name, exactly once normalised. */
    readonly names: ReadonlyArray<NameMatch>
    /** The contact of a valid link token the person presented, or null. */
    readonly token: TokenContact | null
}

/** A contact whose display name equals another's, exactly once normalised: a weak signal, a suggestion only. */
export interface NameMatch {
    /** The contact. */
    readonly contactId: string
    /** Its workspace. */
    readonly workspaceId: string
}

/** Why a suggestion "maybe the same person" was raised: a same name, or a claim equal to an identity another contact holds. */
export type SuggestionWhy = "same_name" | "claimed_identity"

/** "Maybe the same person": shown to a person, never applied by itself. */
export interface ContactSuggestion {
    /** The other contact. */
    readonly contactId: string
    /** Why. */
    readonly why: SuggestionWhy
    /** The claimed identity, for `claimed_identity`; null for a same name. */
    readonly identity: IdentityKey | null
}

/** One contact merged into the one an incoming person resolves to, with the proof that makes them one person. */
export interface ResolvedMerge {
    /** The contact that goes. */
    readonly from: string
    /** Why it is the same person. */
    readonly reason: MergeReason
}

/**
 * What resolving an incoming person comes to:
 *  - `contact`: the person IS this contact (a channel / outside id it holds, an exact VERIFIED phone or mail, a link token); `attach` the
 *    incoming identities it does not hold yet, `merges` the other contacts the same proof shows are this person;
 *  - `create`: nobody holds a proving identity: a new contact with `attach`.
 * Both carry the suggestions (weak signals, claims equal to another's identity): shown to a person, never merged.
 */
export type Resolution =
    | {
          readonly outcome: "contact"
          readonly contactId: string
          readonly attach: ReadonlyArray<NormalIdentity>
          readonly merges: ReadonlyArray<ResolvedMerge>
          readonly suggestions: ReadonlyArray<ContactSuggestion>
      }
    | {
          readonly outcome: "create"
          readonly attach: ReadonlyArray<NormalIdentity>
          readonly suggestions: ReadonlyArray<ContactSuggestion>
      }

/** Who decided a change to a contact: a person, a person approving a step's call, a step on its own, or the channel's own word. */
export type ContactActor =
    | { readonly kind: "member"; readonly memberId: string }
    | { readonly kind: "step"; readonly agentId: string; readonly stepKey: string | null; readonly approvedBy: string | null }
    | { readonly kind: "channel" }

/** A contact with its identities, or `null` when none matched. */
export type OptionalContact = ContactWithIdentities | null

/** An optional id: the contact an identity or a conversation names, or null. */
export type OptionalContactId = string | null

/** An identity value as the store compares it (a phone, a mail address), or null when the text has not the shape. */
export type OptionalIdentityValue = string | null

/** The name a contact shows, or null for one with none. */
export type OptionalDisplayName = string | null

/** The reason a contact was merged into another, or null when it was not merged. */
export type OptionalMergeReason = MergeReason | null

/** A stored identity, or null when none matched. */
export type OptionalContactIdentity = ContactIdentity | null

/** The identity an outside system knows a contact by, or null when nobody linked one. */
export type OptionalExternalIdentity = string | null

/** The member who decided a merge, or null when the system did. */
export type OptionalDecider = string | null

/** The row a page of contacts starts after: its time and id. */
export interface ContactsCursor {
    /** The row's creation time, ISO UTC. */
    readonly createdAt: string
    /** The row id. */
    readonly id: string
}

/** The cursor of a page, or null for the first page. */
export type OptionalContactsCursor = ContactsCursor | null

/** The person a channel names, without the name it shows: the channel, the connection it came through and its own user id. */
export interface ChannelPersonKey {
    /** The channel (`zalo`, `telegram`, `facebook`, `instagram`, `website`). */
    readonly channel: string
    /** The connection the message came through. */
    readonly account: string
    /** The channel's own id of the person. */
    readonly userId: string
}

/** What a merge asks: the contact that stays, the one that goes, and who decided. */
export interface MergeAsk {
    /** The contact that stays. */
    readonly into: string
    /** The contact that goes. */
    readonly from: string
    /** Who decided. */
    readonly by: ContactActor
}

/** The facts of a contact's memory, by name (the newest value wins). */
export interface ContactFacts {
    /** One fact. */
    readonly [name: string]: JsonValue
}
