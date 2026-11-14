import { createHash, randomBytes } from "node:crypto"
import { Inject, Injectable, Optional } from "@nestjs/common"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type {
    ChannelPersonKey,
    Contact,
    ContactActor,
    ContactFacts,
    ContactIdentity,
    ContactSuggestion,
    ContactWithIdentities,
    IdentityInput,
    MergeAsk,
    MergeReason,
    NormalIdentity,
    OptionalContact,
    OptionalContactId,
    OptionalContactsCursor,
    OptionalExternalIdentity,
    OptionalMergeReason,
} from "./contacts.contracts"
import { CONTACT_MEMORY, type ContactMemoryPort, type ContactMemoryReader, type ContactMemoryView } from "./contact-memory.port"
import { CONTACT_RECORDS, type ContactRecordsPort } from "./contact-records.port"
import { CONTACT_RUNS, type ContactRunsPort } from "./contact-runs.port"
import { CONTACTS_STORE, type ContactsStore, type ContactsTx } from "./contacts-store.port"
import { identityKeyText, keyOf, normalIdentityOf, normaliseEmail, normalisePhone } from "./contact-identity.policy"
import { mergeReasonOf, resolveContact } from "./contact-resolve.policy"
import { ContactsError, ContactsErrorCode } from "./errors/contacts.error"

/** How long a one-time link token is valid: a day. */
export const LINK_TOKEN_TTL_MS: number = 24 * 60 * 60 * 1000

/** The longest display name. */
const NAME_MAX = 200

/** The most tags of one contact, and the longest tag. */
const TAGS_MAX = 20
const TAG_MAX = 40

/** The most contacts one search or one page answers. */
export const CONTACTS_PAGE_MAX = 50

/** A channel's person as the intake meets them: the channel, the account it came through, the channel's own user id, the name shown. */
export interface ChannelPerson extends ChannelPersonKey {
    /** The name the channel shows; null when it shows none. */
    readonly name: string | null
}

/** What linking an identity came to. */
export type LinkOutcome =
    | { readonly kind: "linked"; readonly identity: ContactIdentity }
    | { readonly kind: "proposed"; readonly identity: ContactIdentity }
    | { readonly kind: "merged"; readonly contactId: string; readonly reason: MergeReason }
    | { readonly kind: "refused"; readonly reason: "contact_missing" | "identity_invalid" | "identity_taken" }

/** What a merge came to. */
export type MergeOutcome =
    | { readonly kind: "merged"; readonly contactId: string; readonly reason: MergeReason }
    | { readonly kind: "refused"; readonly reason: "contact_missing" | "same_contact" | "no_proof" | "token_invalid" }

/** What an update came to. */
export type UpdateOutcome = { readonly kind: "updated"; readonly contactId: string } | { readonly kind: "refused"; readonly reason: "contact_missing" }

/** What an unlink came to. */
export type UnlinkOutcome =
    | { readonly kind: "unlinked"; readonly identity: ContactIdentity }
    | { readonly kind: "refused"; readonly reason: "contact_missing" | "identity_missing" }

/** What a soft deletion came to: how many identities were marked and how many records were soft-deleted (or cleared). */
export type EraseOutcome =
    | {
          readonly kind: "erased"
          /** Identities marked deleted with the contact (they stay in the database). */
          readonly identities: number
          /** Records that pointed at the contact and were soft-deleted (their cascades included). */
          readonly records: number
          /** Records whose contact field was emptied (a field declared `clear`). */
          readonly cleared: number
      }
    | { readonly kind: "refused"; readonly reason: "contact_missing" | "records_blocked" }

/** What forgetting memory came to: the fact names that were held. */
export type ForgetOutcome =
    | { readonly kind: "forgotten"; readonly facts: ReadonlyArray<string> }
    | { readonly kind: "refused"; readonly reason: "contact_missing" }

/** The members of a contact a person or a step changes: the display name and the tags; nothing else lives on a contact. */
export interface ContactChange {
    /** The new display name; null clears it. */
    readonly displayName?: string | null | undefined
    /** The new tags (the whole set). */
    readonly tags?: ReadonlyArray<string> | undefined
}

/** The proof a merge was decided with: a person decided it, or a person approved the step's call; else none. */
const approvalOf = (by: ContactActor): string | null => {
    if (by.kind === "member") return by.memberId
    if (by.kind === "step") return by.approvedBy
    return null
}

/** A display name trimmed and bounded; null when empty. */
const nameOf = (raw: string | null | undefined): string | null => {
    const name = raw?.trim() ?? ""
    return name === "" ? null : name.slice(0, NAME_MAX)
}

/** Tags trimmed, empty ones dropped, each once, bounded. */
const tagsOf = (raw: ReadonlyArray<string>): ReadonlyArray<string> =>
    [...new Set(raw.map((tag) => tag.trim().slice(0, TAG_MAX)).filter((tag) => tag !== ""))].slice(0, TAGS_MAX)

/** A uuid's shape: an id of another shape names no contact (and is never sent to the store). A format check. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** True for a text shaped like a contact id. */
export const isContactId = (id: string): boolean => UUID.test(id)

/** The SHA-256 of a link token, hex: the only form the store keeps. */
const hashOf = (token: string): string => createHash("sha256").update(token).digest("hex")

/** The older contact (it survives a merge): the earlier met, then the smaller id. */
const olderOf = (left: Contact, right: Contact): Contact => {
    if (left.createdAt === right.createdAt) return left.id < right.id ? left : right
    return left.createdAt < right.createdAt ? left : right
}

/**
 * The SQLSTATEs of a conflict with a concurrent writer that a second attempt resolves: a unique violation (a racing delivery wrote the
 * identity first), a deadlock detected (40P01) and a serialization failure (40001). A dropped connection, a pool timeout, a lock timeout
 * (55P03) and every other failure are not conflicts and surface.
 */
const TRANSIENT_CONFLICT_CODES: ReadonlySet<string> = new Set(["23505", "40P01", "40001"])

/** The SQLSTATE a failure carries: on the error itself, or on the driver error a QueryFailedError wraps. */
const sqlStateOf = (cause: unknown): string | null => {
    if (typeof cause !== "object" || cause === null) return null
    if ("code" in cause && typeof cause.code === "string") return cause.code
    if ("driverError" in cause) return sqlStateOf(cause.driverError)
    return null
}

const isTransientConflict = (cause: unknown): boolean => {
    const code = sqlStateOf(cause)
    return code !== null && TRANSIENT_CONFLICT_CODES.has(code)
}

@Injectable()
/**
 * The engine's contacts: every person the agents work with, ONE person = ONE contact. Identity resolution follows the owner's rules
 * exactly (contacts.md): a contact merges with another ONLY on an exact VERIFIED phone or mail, a one-time link token, or a person's
 * approval; a self-declared identity is kept as a proposal (unverified) and merges nothing; a same name is a suggestion. Every lookup is
 * an exact comparison of normalised identifiers. A merge keeps ONE redirect (`contact_merges`) that every engine row keyed by the old id
 * follows at read time; a deletion is soft (the contact, its identities, memory, routes and lines stay and every read leaves them out). Every change is audited with who decided.
 */
export class ContactsService {
    constructor(
        @Inject(CONTACTS_STORE) private readonly store: ContactsStore,
        @InjectClock() private readonly clock: Clock,
        @Optional() @Inject(CONTACT_MEMORY) private readonly memory?: ContactMemoryPort,
        @Optional() @Inject(CONTACT_RECORDS) private readonly records?: ContactRecordsPort,
        @Optional() @Inject(CONTACT_RUNS) private readonly runs?: ContactRunsPort,
    ) {}

    /**
     * The contact of a person a channel delivered a message from, met before any module sees them: the contact that holds the channel's
     * own id of them (the channel vouches for it), else a new contact with that identity. Idempotent: the same id met again is the same
     * contact; two deliveries racing make one (the second retries on the identity's unique key); a deadlock or serialization failure is retried the same single time.
     */
    async meetChannel(workspaceId: string, person: ChannelPerson): Promise<string> {
        const identity = normalIdentityOf({
            kind: "channel",
            provider: person.channel,
            account: person.account,
            value: person.userId,
            proof: "channel",
        })
        if (identity === null) throw new ContactsError({ code: ContactsErrorCode.IdentityInvalid })
        const meet = (): Promise<string> =>
            this.store.transaction(async (tx) => {
                const matches = await tx.matchesOf(workspaceId, [identity])
                const resolved = resolveContact(workspaceId, { incoming: [identity], matches, names: [], token: null })
                if (resolved.outcome === "contact") return resolved.contactId
                const made = await tx.insertContact(workspaceId, nameOf(person.name))
                await tx.putIdentity(workspaceId, made.id, identity, "channel", null)
                return made.id
            })
        try {
            return await meet()
        } catch (cause) {
            if (!isTransientConflict(cause)) throw cause
            return await meet()
        }
    }

    /** The contact that holds a channel's own id of a person, or null when no contact does. One exact lookup. */
    async contactOfChannel(workspaceId: string, person: ChannelPersonKey): Promise<OptionalContactId> {
        const identity = normalIdentityOf({ kind: "channel", provider: person.channel, account: person.account, value: person.userId })
        if (identity === null) return null
        const matches = await this.store.transaction((tx) => tx.matchesOf(workspaceId, [identity]))
        return matches.find((match) => match.verified)?.contactId ?? null
    }

    /** The contact an id stands for now: itself, or the survivor it was merged into; null for an id the workspace does not hold. */
    current(workspaceId: string, contactId: string): Promise<OptionalContactId> {
        return this.store.transaction((tx) => this.currentIn(tx, workspaceId, contactId))
    }

    /**
     * The LIVE contact an id stands for now: itself, or the survivor it was merged into; null for an id the workspace does not hold and for
     * a deleted contact (soft delete, owner ruling R31). What every reader of a person's routes, lines and memory asks before it reads.
     */
    activeId(workspaceId: string, contactId: string): Promise<OptionalContactId> {
        return this.store.transaction(async (tx) => (await this.activeIn(tx, workspaceId, contactId))?.id ?? null)
    }

    /** The contact and every id merged into it, the contact first: what a hold or a memory entry written under an old id is found by. */
    aliasesOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<string>> {
        return this.store.transaction(async (tx) => {
            const current = await this.currentIn(tx, workspaceId, contactId)
            if (current === null) return [contactId]
            return [current, ...(await tx.aliasesOf(workspaceId, current))]
        })
    }

    /** The active contact an id stands for, with its identities; null when it is unknown, erased or of another workspace. */
    get(workspaceId: string, contactId: string): Promise<OptionalContact> {
        return this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return null
            return { ...contact, identities: await tx.identitiesOf(workspaceId, [contact.id]) }
        })
    }

    /** How many people were created in `[from, to)` (the active ones): the figure the dashboard calls new contacts. */
    countCreated(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.store.transaction((tx) => tx.countCreated(workspaceId, from, to))
    }

    /** A page of the people of the workspace, newest first, with their identities. */
    list(
        workspaceId: string,
        after: OptionalContactsCursor,
        size: number,
    ): Promise<ReadonlyArray<ContactWithIdentities>> {
        return this.store.transaction(async (tx) => {
            const contacts = await tx.page(workspaceId, { after, size: Math.max(1, Math.min(CONTACTS_PAGE_MAX, size)) })
            return this.withIdentities(tx, workspaceId, contacts)
        })
    }

    /**
     * People found by a query: an exact identifier (a phone or a mail in any written form, compared normalised) or a name prefix. A
     * lookup for a person or an internal step, never identity resolution: it merges nothing.
     */
    search(workspaceId: string, query: string, size: number): Promise<ReadonlyArray<ContactWithIdentities>> {
        const bound = Math.max(1, Math.min(CONTACTS_PAGE_MAX, size))
        const phone = normalisePhone(query)
        const mail = normaliseEmail(query)
        const keys = [
            ...(phone === null ? [] : [{ kind: "phone" as const, provider: "", account: "", value: phone }]),
            ...(mail === null ? [] : [{ kind: "email" as const, provider: "", account: "", value: mail }]),
        ]
        return this.store.transaction(async (tx) => {
            const matched = await tx.matchesOf(workspaceId, keys)
            const exact = await tx.contactsOf(workspaceId, [...new Set(matched.map((match) => match.contactId))])
            const named = query.trim() === "" ? [] : await tx.byNamePrefix(workspaceId, query, bound)
            const seen = new Set<string>()
            const found = [...exact, ...named].filter((one) => {
                if (seen.has(one.id) || one.state !== "active") return false
                seen.add(one.id)
                return true
            })
            return this.withIdentities(tx, workspaceId, found.slice(0, bound))
        })
    }

    /** Changes the display name and / or the tags of a contact; audited. */
    update(workspaceId: string, contactId: string, change: ContactChange, by: ContactActor): Promise<UpdateOutcome> {
        return this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return { kind: "refused", reason: "contact_missing" }
            const values = {
                ...(change.displayName === undefined ? {} : { displayName: nameOf(change.displayName) }),
                ...(change.tags === undefined ? {} : { tags: tagsOf(change.tags) }),
            }
            await tx.updateContact(workspaceId, contact.id, values)
            await tx.insertEvent(workspaceId, {
                contactId: contact.id,
                action: "updated",
                detail: { name: values.displayName !== undefined, tags: values.tags?.length ?? null },
                by,
            })
            return { kind: "updated", contactId: contact.id }
        })
    }

    /**
     * Adds an identity to a contact, by its proof only: with no proof it is kept as a PROPOSAL (unverified) and merges nothing; a VERIFIED
     * phone or mail another contact holds verified is the exact match that makes them one person: they merge (the older survives). A
     * verified channel or outside id another contact holds is refused (`identity_taken`): moving it is a person's merge.
     */
    async linkIdentity(workspaceId: string, contactId: string, input: IdentityInput, by: ContactActor): Promise<LinkOutcome> {
        const identity = normalIdentityOf(input)
        if (identity === null) return { kind: "refused", reason: "identity_invalid" }
        const outcome = await this.store.transaction(async (tx): Promise<LinkOutcome | { readonly kind: "merge"; readonly into: Contact; readonly from: Contact; readonly reason: MergeReason }> => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return { kind: "refused", reason: "contact_missing" }
            const source = by.kind
            if (identity.proof !== null) {
                const holder = (await tx.matchesOf(workspaceId, [identity])).find((match) => match.verified && match.contactId !== contact.id)
                if (holder !== undefined) {
                    const reason = mergeReasonOf(identity)
                    if (reason === null) return { kind: "refused", reason: "identity_taken" }
                    const [other] = await tx.contactsOf(workspaceId, [holder.contactId])
                    if (other === undefined) return { kind: "refused", reason: "identity_taken" }
                    const into = olderOf(contact, other)
                    return { kind: "merge", into, from: into.id === contact.id ? other : contact, reason }
                }
            }
            const written = await tx.putIdentity(workspaceId, contact.id, identity, source, null)
            if (written === "taken") return { kind: "refused", reason: "identity_taken" }
            const held = (await tx.identitiesOf(workspaceId, [contact.id])).find((one) => identityKeyText(one) === identityKeyText(identity))
            if (held === undefined) return { kind: "refused", reason: "identity_invalid" }
            await tx.insertEvent(workspaceId, {
                contactId: contact.id,
                action: "identity_linked",
                detail: { identityId: held.id, kind: held.kind, account: held.account, verified: held.verified },
                by,
            })
            return held.verified ? { kind: "linked", identity: held } : { kind: "proposed", identity: held }
        })
        if (outcome.kind !== "merge") return outcome
        await this.mergeNow(workspaceId, outcome.into.id, outcome.from.id, outcome.reason, by)
        await this.store.transaction((tx) =>
            tx.putIdentity(workspaceId, outcome.into.id, identity, by.kind, null),
        )
        return { kind: "merged", contactId: outcome.into.id, reason: outcome.reason }
    }

    /** Takes one identity away from a contact (a person's act on the page); audited. */
    unlinkIdentity(workspaceId: string, contactId: string, identityId: string, by: ContactActor): Promise<UnlinkOutcome> {
        return this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return { kind: "refused", reason: "contact_missing" }
            const gone = await tx.deleteIdentity(workspaceId, contact.id, identityId)
            if (gone === null) return { kind: "refused", reason: "identity_missing" }
            await tx.insertEvent(workspaceId, {
                contactId: contact.id,
                action: "identity_unlinked",
                detail: { identityId: gone.id, kind: gone.kind, account: gone.account },
                by,
            })
            return { kind: "unlinked", identity: gone }
        })
    }

    /**
     * Merges `from` into `into` on a person's decision (a member on the page, or a person who approved the step's call): the reason is
     * `member_approved`. A proof merges by itself elsewhere (a verified identity on link, a token on redeem), so a merge no person decided
     * is refused (`no_proof`). The store's integrity: a contact of the workspace each, never one with itself.
     */
    async merge(workspaceId: string, ask: MergeAsk): Promise<MergeOutcome> {
        const pair = await this.store.transaction(async (tx) => {
            const into = await this.activeIn(tx, workspaceId, ask.into)
            const from = await this.activeIn(tx, workspaceId, ask.from)
            return { into, from }
        })
        if (pair.into === null || pair.from === null) return { kind: "refused", reason: "contact_missing" }
        if (pair.into.id === pair.from.id) return { kind: "refused", reason: "same_contact" }
        if (approvalOf(ask.by) === null) return { kind: "refused", reason: "no_proof" }
        return this.mergeNow(workspaceId, pair.into.id, pair.from.id, "member_approved", ask.by)
    }

    /** A new one-time link token for the contact, valid a day; only its hash is kept. Presented once, it merges the presenter in. */
    async issueLinkToken(workspaceId: string, contactId: string): Promise<string> {
        const token = randomBytes(24).toString("base64url")
        await this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) throw new ContactsError({ code: ContactsErrorCode.ContactMissing })
            await tx.insertToken(workspaceId, contact.id, hashOf(token), new Date(this.clock.now().getTime() + LINK_TOKEN_TTL_MS))
        })
        return token
    }

    /** The contact presenting a valid link token merges into the contact it was issued for (`link_token`); the token is used once. */
    async redeemLinkToken(workspaceId: string, presenterId: string, token: string, by: ContactActor): Promise<MergeOutcome> {
        const now = this.clock.now()
        const found = await this.store.transaction(async (tx) => {
            const stored = await tx.tokenOf(workspaceId, hashOf(token.trim()))
            if (stored === null || stored.usedAt !== null || stored.expiresAt.getTime() <= now.getTime()) return null
            const owner = await this.activeIn(tx, workspaceId, stored.contactId)
            const presenter = await this.activeIn(tx, workspaceId, presenterId)
            if (owner === null || presenter === null || owner.id === presenter.id) return null
            return (await tx.useToken(workspaceId, stored.id, presenter.id, now)) ? { into: owner.id, from: presenter.id } : null
        })
        if (found === null) return { kind: "refused", reason: "token_invalid" }
        return this.mergeNow(workspaceId, found.into, found.from, "link_token", by)
    }

    /**
     * Deletes a contact on a person's decision, SOFTLY (owner ruling R31): first every record of any agent that points at it or at an id
     * merged into it is soft-deleted (records.md; a `clear` field is emptied; a `restrict` ref there refuses the whole deletion,
     * `records_blocked`, before anything changed), then, in one transaction, the runs parked on the person or on their routes are ended
     * (`CONTACT_RUNS`, ruling R37: `subject_erased`) and the contact, every id merged into it and every identity they hold are marked deleted. Nothing is removed: the identities, the memory, the routes and the customer lines stay in the database
     * and every read leaves them out. The person writing again is met as a NEW contact (the deleted contact's identities are no longer
     * matched), never as this one. The raw account data stays until its own retention.
     */
    async delete(workspaceId: string, contactId: string, by: ContactActor): Promise<EraseOutcome> {
        const found = await this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            return contact === null ? null : [contact.id, ...(await tx.aliasesOf(workspaceId, contact.id))]
        })
        if (found === null) return { kind: "refused", reason: "contact_missing" }
        const records = (await this.records?.erase(workspaceId, found)) ?? { kind: "erased", records: 0, cleared: 0 }
        if (records.kind === "blocked") return { kind: "refused", reason: "records_blocked" }
        const erased = await this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return null
            const all = [contact.id, ...(await tx.aliasesOf(workspaceId, contact.id))]
            // The runs parked on the person end FIRST, in this same transaction (R37): their subjects (the ids and the person's routes)
            // are read while the contacts are still live; after the mark every read leaves them out.
            if (this.runs !== undefined && tx.manager !== undefined) await this.runs.erasing(tx.manager, workspaceId, all)
            const identities = await tx.eraseContacts(workspaceId, all, this.clock.now())
            await tx.insertEvent(workspaceId, {
                contactId: contact.id,
                action: "erased",
                detail: { identities, aliases: all.length - 1, records: records.records, cleared: records.cleared },
                by,
            })
            return { identities }
        })
        if (erased === null) return { kind: "refused", reason: "contact_missing" }
        return { kind: "erased", identities: erased.identities, records: records.records, cleared: records.cleared }
    }

    /** What the workflows remember of a contact; empty for a contact the workspace does not hold. */
    async memoryOf(workspaceId: string, contactId: string, reader: ContactMemoryReader): Promise<ContactMemoryView> {
        const current = await this.activeId(workspaceId, contactId)
        if (current === null || this.memory === undefined) return { facts: {}, notes: [] }
        return this.memory.read(workspaceId, current, reader)
    }

    /** Lays facts over a contact's memory (the newest value wins); false for a contact the workspace does not hold. */
    async remember(workspaceId: string, contactId: string, facts: ContactFacts): Promise<boolean> {
        const contact = await this.get(workspaceId, contactId)
        if (contact === null) return false
        await this.memory?.remember(workspaceId, contact.id, facts)
        return true
    }

    /** Forgets the named facts of a contact; audited. */
    async forget(workspaceId: string, contactId: string, facts: ReadonlyArray<string>, by: ContactActor): Promise<ForgetOutcome> {
        const contact = await this.get(workspaceId, contactId)
        if (contact === null) return { kind: "refused", reason: "contact_missing" }
        const gone = (await this.memory?.forget(workspaceId, contact.id, facts)) ?? []
        await this.store.transaction((tx) =>
            tx.insertEvent(workspaceId, { contactId: contact.id, action: "memory_forgotten", detail: { facts: [...gone] }, by }),
        )
        return { kind: "forgotten", facts: gone }
    }

    /** The identity an outside system knows the contact by on the account, or null when nobody linked one. */
    async externalOf(workspaceId: string, contactId: string, account: string): Promise<OptionalExternalIdentity> {
        const contact = await this.get(workspaceId, contactId)
        return contact?.identities.find((one) => one.kind === "external" && one.account === account && one.verified)?.value ?? null
    }

    /** The reason the contact's id was merged into another, or null: what the page shows beside an identity's merge history. */
    mergeReasonOf(workspaceId: string, contactId: string): Promise<OptionalMergeReason> {
        return this.store.transaction((tx) => tx.mergeReasonOf(workspaceId, contactId))
    }

    /**
     * "Maybe the same person": other contacts with the same display name, and contacts holding an identity this one only claims (or
     * claiming one this one holds). Read on demand, shown to a person, never applied.
     */
    suggestionsOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<ContactSuggestion>> {
        return this.store.transaction(async (tx) => {
            const contact = await this.activeIn(tx, workspaceId, contactId)
            if (contact === null) return []
            const own = await tx.identitiesOf(workspaceId, [contact.id])
            const people: ReadonlyArray<NormalIdentity> = own
                .filter((one) => one.kind === "phone" || one.kind === "email")
                .map((one) => ({ ...keyOf(one), proof: one.verifiedBy }))
            const matches = await tx.matchesOf(workspaceId, people)
            const names = contact.displayName === null ? [] : await tx.namesOf(workspaceId, contact.displayName)
            const ownVerified = new Set(own.filter((one) => one.verified).map((one) => identityKeyText(one)))
            const claimed = matches.filter(
                (match) => match.contactId !== contact.id && (!match.verified || !ownVerified.has(identityKeyText(match.key))),
            )
            const resolved = resolveContact(workspaceId, {
                incoming: people.map((one) => ({ ...one, proof: null })),
                matches: claimed.map((match) => ({ ...match, verified: false })),
                names: names.filter((name) => name.contactId !== contact.id),
                token: null,
            })
            return resolved.suggestions
        })
    }

    /** Moves `from` into `into` for the reason: identities (marked with it), tags, a missing name, the redirect, the memory; audited. */
    private async mergeNow(workspaceId: string, into: string, from: string, reason: MergeReason, by: ContactActor): Promise<MergeOutcome> {
        await this.store.transaction(async (tx) => {
            const [survivor, loser] = await Promise.all([this.activeIn(tx, workspaceId, into), this.activeIn(tx, workspaceId, from)])
            if (survivor === null || loser === null) return
            await tx.moveIdentities(workspaceId, loser.id, survivor.id, reason)
            await tx.updateContact(workspaceId, survivor.id, {
                tags: tagsOf([...survivor.tags, ...loser.tags]),
                ...(survivor.displayName === null && loser.displayName !== null ? { displayName: loser.displayName } : {}),
            })
            await tx.insertMerge(workspaceId, loser.id, survivor.id, reason, approvalOf(by))
            await tx.updateContact(workspaceId, loser.id, { state: "merged" })
            await tx.insertEvent(workspaceId, { contactId: survivor.id, action: "merged", detail: { from: loser.id, reason }, by })
        })
        await this.memory?.rekey(workspaceId, from, into)
        return { kind: "merged", contactId: into, reason }
    }

    private async currentIn(tx: ContactsTx, workspaceId: string, contactId: string): Promise<OptionalContactId> {
        if (!isContactId(contactId)) return null
        const redirect = (await tx.redirectsOf(workspaceId, [contactId])).get(contactId)
        if (redirect !== undefined) return redirect
        const [held] = await tx.contactsOf(workspaceId, [contactId])
        return held === undefined ? null : held.id
    }

    private async activeIn(tx: ContactsTx, workspaceId: string, contactId: string): Promise<Contact | null> {
        const current = await this.currentIn(tx, workspaceId, contactId)
        if (current === null) return null
        const [contact] = await tx.contactsOf(workspaceId, [current])
        return contact?.state === "active" ? contact : null
    }

    private async withIdentities(
        tx: ContactsTx,
        workspaceId: string,
        contacts: ReadonlyArray<Contact>,
    ): Promise<ReadonlyArray<ContactWithIdentities>> {
        const identities = await tx.identitiesOf(workspaceId, contacts.map((one) => one.id))
        return contacts.map((contact) => ({ ...contact, identities: identities.filter((one) => one.contactId === contact.id) }))
    }
}
