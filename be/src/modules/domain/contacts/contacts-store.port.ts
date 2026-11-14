import type { EntityManager } from "typeorm"
import type {
    Contact,
    ContactActor,
    ContactIdentity,
    IdentityKey,
    IdentityMatch,
    IdentityProof,
    IdentitySource,
    MergeReason,
    NameMatch,
    NormalIdentity,
    OptionalContactIdentity,
    OptionalContactsCursor,
    OptionalDecider,
    OptionalDisplayName,
    OptionalMergeReason,
} from "./contacts.contracts"

/** The members of a contact a write sets. */
export interface ContactValues {
    /** The display name; null clears it. */
    readonly displayName?: string | null
    /** The tags. */
    readonly tags?: ReadonlyArray<string>
    /** The state (a merge writes `merged`; a deletion goes through `eraseContacts`, which also marks the identities). */
    readonly state?: Exclude<Contact["state"], "erased">
}

/** A one-time link token as the store keeps it. */
export interface StoredLinkToken {
    /** The row id. */
    readonly id: string
    /** The contact it was issued for. */
    readonly contactId: string
    /** When it stops being valid. */
    readonly expiresAt: Date
    /** When it was used, or null. */
    readonly usedAt: Date | null
}

/** One audit row of a contact. */
export interface ContactEventWrite {
    /** The contact. */
    readonly contactId: string
    /** What was done. */
    readonly action: "identity_linked" | "identity_unlinked" | "merged" | "updated" | "memory_forgotten" | "erased"
    /** Ids and kinds of what changed. */
    readonly detail: Readonly<Record<string, unknown>>
    /** Who decided. */
    readonly by: ContactActor
}

/** A page of the contacts of a workspace, newest first, after a cursor (the last row's time and id). */
export interface ContactsPageAsk {
    /** The most rows. */
    readonly size: number
    /** The row the page starts after, or null for the first page. */
    readonly after: OptionalContactsCursor
}

/** What happened to an identity written: it is now held by the contact, or another contact holds it verified (nothing was written). */
export type IdentityWrite = "held" | "taken"

/**
 * The one transaction of the contacts store: every read and write of a change happens in it. Every member is workspace-scoped; nothing
 * of another workspace is read or written. Identity lookups are EXACT comparisons of the normalised key.
 */
export interface ContactsTx {
    /**
     * The database transaction this one runs in, for a port that must write in the SAME transaction (the work engine ending the runs of
     * a deleted person, `CONTACT_RUNS`); absent in a store with no database.
     */
    readonly manager?: EntityManager | undefined
    /** Contacts by id (any state: a merged or deleted one answers as it stands). */
    contactsOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<Contact>>
    /** A new active contact. */
    insertContact(workspaceId: string, displayName: OptionalDisplayName): Promise<Contact>
    /** Writes members of a contact. */
    updateContact(workspaceId: string, id: string, values: ContactValues): Promise<void>
    /** The live identities of the contacts, oldest first (the identities of a deleted contact are left out). */
    identitiesOf(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ReadonlyArray<ContactIdentity>>
    /** Every live identity of an active contact equal to one of the keys, exactly (a deleted contact's identities are never matched). */
    matchesOf(workspaceId: string, keys: ReadonlyArray<IdentityKey>): Promise<ReadonlyArray<IdentityMatch>>
    /** The active contacts whose display name equals the name, compared lower-cased and trimmed; bounded. */
    namesOf(workspaceId: string, name: string): Promise<ReadonlyArray<NameMatch>>
    /**
     * Writes an identity on a contact: a claim is added (or kept) on that contact; a verified one is added, or a claim the contact held of
     * it is proven, unless another contact holds it verified (`taken`, nothing written).
     */
    putIdentity(
        workspaceId: string,
        contactId: string,
        identity: NormalIdentity,
        source: IdentitySource,
        joinedBy: OptionalMergeReason,
    ): Promise<IdentityWrite>
    /** Moves every identity of `from` to `into`, marked with the merge reason; one `into` already holds the same way is dropped. */
    moveIdentities(workspaceId: string, from: string, into: string, joinedBy: MergeReason): Promise<void>
    /** Removes one identity of a contact; null when the contact holds none by that id. */
    deleteIdentity(workspaceId: string, contactId: string, identityId: string): Promise<OptionalContactIdentity>
    /**
     * Soft-deletes the contacts (owner ruling R31): each is marked `erased` at `at` and so is every identity it holds, in this one
     * transaction; nothing is removed (display name, tags, identities, merges and tokens stay and are left out of every read). A contact
     * already erased keeps its first mark. Answers how many identities were marked.
     */
    eraseContacts(workspaceId: string, contactIds: ReadonlyArray<string>, at: Date): Promise<number>
    /** The contact each id was merged into, for the ids that were (one hop: the store keeps every redirect pointing at a survivor). */
    redirectsOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>>
    /** The ids merged into the contact (its aliases), in the order they were merged. */
    aliasesOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<string>>
    /** Records that `from` was merged into `into`, and points every redirect to `from` at `into`. */
    insertMerge(workspaceId: string, from: string, into: string, reason: MergeReason, decidedBy: OptionalDecider): Promise<void>
    /** The merge reason that took `from` away, or null when it was not merged. */
    mergeReasonOf(workspaceId: string, from: string): Promise<OptionalMergeReason>
    /** A link token by its hash. */
    tokenOf(workspaceId: string, hash: string): Promise<OptionalStoredLinkToken>
    /** Keeps a new link token's hash. */
    insertToken(workspaceId: string, contactId: string, hash: string, expiresAt: Date): Promise<void>
    /** Marks a link token used by a contact; false when another use beat it. */
    useToken(workspaceId: string, tokenId: string, byContactId: string, at: Date): Promise<boolean>
    /** Appends one audit row. */
    insertEvent(workspaceId: string, event: ContactEventWrite): Promise<void>
    /** A page of the active contacts, newest first. */
    page(workspaceId: string, ask: ContactsPageAsk): Promise<ReadonlyArray<Contact>>
    /** How many active contacts were created in `[from, to)`. */
    countCreated(workspaceId: string, from: Date, to: Date): Promise<number>
    /** The active contacts whose display name starts with the prefix (lower-cased), bounded. */
    byNamePrefix(workspaceId: string, prefix: string, size: number): Promise<ReadonlyArray<Contact>>
}

/** Work run in one transaction of the contacts store. */
export type ContactsWork<T> = (tx: ContactsTx) => Promise<T>

/** A stored link token, or null when none has the hash. */
export type OptionalStoredLinkToken = StoredLinkToken | null

/** The contacts store: runs work in one transaction. */
export interface ContactsStore {
    /** Runs the work in one transaction; a throw rolls every write back. */
    transaction<T>(work: ContactsWork<T>): Promise<T>
}

/** The injection token of the contacts store. */
export const CONTACTS_STORE: unique symbol = Symbol("CONTACTS_STORE")

/** The proofs a store accepts, in order of strength (none ranks above another; the list is closed). */
export const IDENTITY_PROOFS: ReadonlyArray<IdentityProof> = ["channel", "token", "member"]
