import { Injectable } from "@nestjs/common"
import { And, ILike, In, IsNull, LessThan, MoreThanOrEqual, type EntityManager, type FindOptionsWhere } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    Contact,
    ContactIdentity,
    IdentityKey,
    IdentityMatch,
    IdentityProof,
    IdentitySource,
    MergeReason,
    NameMatch,
    NormalIdentity,
} from "./contacts.contracts"
import type {
    ContactEventWrite,
    ContactsPageAsk,
    ContactsStore,
    ContactsTx,
    ContactValues,
    IdentityWrite,
    StoredLinkToken,
} from "./contacts-store.port"
import {
    ContactEntity,
    ContactEventEntity,
    ContactIdentityEntity,
    ContactLinkTokenEntity,
    ContactMergeEntity,
} from "./persistence/entities"

/** The most identities of one lookup or one set of contacts read at once. */
const IDENTITIES_MAX = 200

/** The most contacts a same-name look finds: enough for a suggestion list. */
const NAMES_MAX = 10

/** A LIKE pattern's own characters escaped, so a name is compared as text. */
const likeText = (text: string): string => text.replaceAll(/[\\%_]/gu, (char) => `\\${char}`)

/** Who decided an event: the member, or the person who approved a step's call; else none. */
const decidedByOf = (by: ContactEventWrite["by"]): string | null => {
    if (by.kind === "member") return by.memberId
    if (by.kind === "step") return by.approvedBy
    return null
}

const contactOf = (row: ContactEntity): Contact => ({
    id: row.id,
    workspaceId: row.workspaceId,
    displayName: row.displayName,
    tags: [...row.tags],
    state: row.state === "merged" || row.state === "erased" ? row.state : "active",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

const identityOf = (row: ContactIdentityEntity): ContactIdentity => ({
    id: row.id,
    contactId: row.contactId,
    kind: row.kind === "email" || row.kind === "channel" || row.kind === "external" ? row.kind : "phone",
    provider: row.provider,
    account: row.account,
    value: row.value,
    verified: row.verified,
    verifiedBy: row.verifiedBy === "channel" || row.verifiedBy === "token" || row.verifiedBy === "member" ? row.verifiedBy : null,
    source: row.source === "step" || row.source === "member" || row.source === "form" ? row.source : "channel",
    joinedBy:
        row.joinedBy === "phone_verified" ||
        row.joinedBy === "email_verified" ||
        row.joinedBy === "link_token" ||
        row.joinedBy === "member_approved"
            ? row.joinedBy
            : null,
    at: row.createdAt.toISOString(),
})

/** Only the identities of a live contact: a deleted contact's identities stay in the table and are left out of every read. */
const keyWhere = (workspaceId: string, key: IdentityKey): FindOptionsWhere<ContactIdentityEntity> => ({
    workspaceId,
    erasedAt: IsNull(),
    kind: key.kind,
    provider: key.provider,
    account: key.account,
    value: key.value,
})

const proofOf = (identity: NormalIdentity): IdentityProof | null => identity.proof

/** The store on public.contacts and its sibling tables, in one transaction of the primary connection. No raw SQL. */
class TypeormContactsTx implements ContactsTx {
    constructor(private readonly tx: EntityManager) {}

    /** The database transaction itself, for a port that writes in it (`ContactsTx.manager`). */
    get manager(): EntityManager {
        return this.tx
    }

    async contactsOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyArray<Contact>> {
        if (ids.length === 0) return []
        const rows = await this.tx.find(ContactEntity, { where: { workspaceId, id: In([...ids]) }, take: ids.length })
        return rows.map((row) => contactOf(row))
    }

    async insertContact(workspaceId: string, displayName: string | null): Promise<Contact> {
        const inserted = await this.tx.insert(ContactEntity, { workspaceId, displayName })
        const id: unknown = inserted.identifiers[0]?.["id"]
        return contactOf(await this.tx.findOneOrFail(ContactEntity, { where: { workspaceId, id: String(id) } }))
    }

    async updateContact(workspaceId: string, id: string, values: ContactValues): Promise<void> {
        await this.tx.update(
            ContactEntity,
            { workspaceId, id },
            {
                ...(values.displayName === undefined ? {} : { displayName: values.displayName }),
                ...(values.tags === undefined ? {} : { tags: [...values.tags] }),
                ...(values.state === undefined ? {} : { state: values.state }),
            },
        )
    }

    async identitiesOf(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ReadonlyArray<ContactIdentity>> {
        if (contactIds.length === 0) return []
        const rows = await this.tx.find(ContactIdentityEntity, {
            where: { workspaceId, contactId: In([...contactIds]), erasedAt: IsNull() },
            order: { createdAt: "ASC", id: "ASC" },
            take: IDENTITIES_MAX,
        })
        return rows.map((row) => identityOf(row))
    }

    async matchesOf(workspaceId: string, keys: ReadonlyArray<IdentityKey>): Promise<ReadonlyArray<IdentityMatch>> {
        if (keys.length === 0) return []
        const rows = await this.tx.find(ContactIdentityEntity, {
            where: keys.map((key) => keyWhere(workspaceId, key)),
            take: IDENTITIES_MAX,
        })
        const contacts = await this.contactsOf(workspaceId, [...new Set(rows.map((row) => row.contactId))])
        const active = new Map(contacts.filter((contact) => contact.state === "active").map((contact) => [contact.id, contact]))
        return rows.flatMap((row) => {
            const contact = active.get(row.contactId)
            return contact === undefined
                ? []
                : [
                      {
                          key: { kind: identityOf(row).kind, provider: row.provider, account: row.account, value: row.value },
                          contactId: row.contactId,
                          workspaceId,
                          verified: row.verified,
                          contactCreatedAt: contact.createdAt,
                      },
                  ]
        })
    }

    async namesOf(workspaceId: string, name: string): Promise<ReadonlyArray<NameMatch>> {
        const wanted = name.trim()
        if (wanted === "") return []
        const rows = await this.tx.find(ContactEntity, {
            select: { id: true },
            where: { workspaceId, state: "active", displayName: ILike(likeText(wanted)) },
            take: NAMES_MAX,
        })
        return rows.map((row) => ({ contactId: row.id, workspaceId }))
    }

    async putIdentity(
        workspaceId: string,
        contactId: string,
        identity: NormalIdentity,
        source: IdentitySource,
        joinedBy: MergeReason | null,
    ): Promise<IdentityWrite> {
        const proof = proofOf(identity)
        const same = await this.tx.find(ContactIdentityEntity, { where: keyWhere(workspaceId, identity), take: IDENTITIES_MAX })
        const provenElsewhere = same.some((row) => row.verified && row.contactId !== contactId)
        if (proof !== null && provenElsewhere) return "taken"
        const mine = same.find((row) => row.contactId === contactId)
        if (mine !== undefined) {
            if (proof !== null && !mine.verified) await this.tx.update(ContactIdentityEntity, { id: mine.id }, { verified: true, verifiedBy: proof })
            return "held"
        }
        await this.tx.insert(ContactIdentityEntity, {
            workspaceId,
            contactId,
            kind: identity.kind,
            provider: identity.provider,
            account: identity.account,
            value: identity.value,
            verified: proof !== null,
            verifiedBy: proof,
            source,
            joinedBy,
        })
        return "held"
    }

    async moveIdentities(workspaceId: string, from: string, into: string, joinedBy: MergeReason): Promise<void> {
        const [moving, kept] = await Promise.all([this.identitiesOf(workspaceId, [from]), this.identitiesOf(workspaceId, [into])])
        const held = new Map(kept.map((one) => [`${one.kind}|${one.provider}|${one.account}|${one.value}`, one]))
        for (const one of moving) {
            const twin = held.get(`${one.kind}|${one.provider}|${one.account}|${one.value}`)
            if (twin === undefined) {
                await this.tx.update(ContactIdentityEntity, { id: one.id }, { contactId: into, joinedBy })
            } else {
                if (one.verified && !twin.verified)
                    await this.tx.update(ContactIdentityEntity, { id: twin.id }, { verified: true, verifiedBy: one.verifiedBy })
                await this.tx.delete(ContactIdentityEntity, { id: one.id })
            }
        }
    }

    async deleteIdentity(workspaceId: string, contactId: string, identityId: string): Promise<ContactIdentity | null> {
        const row = await this.tx.findOne(ContactIdentityEntity, { where: { workspaceId, contactId, id: identityId, erasedAt: IsNull() } })
        if (row === null) return null
        await this.tx.delete(ContactIdentityEntity, { id: row.id })
        return identityOf(row)
    }

    async eraseContacts(workspaceId: string, contactIds: ReadonlyArray<string>, at: Date): Promise<number> {
        if (contactIds.length === 0) return 0
        const ids = [...contactIds]
        await this.tx.update(ContactEntity, { workspaceId, id: In(ids), erasedAt: IsNull() }, { state: "erased", erasedAt: at })
        const marked = await this.tx.update(ContactIdentityEntity, { workspaceId, contactId: In(ids), erasedAt: IsNull() }, { erasedAt: at })
        return marked.affected ?? 0
    }

    async redirectsOf(workspaceId: string, ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        if (ids.length === 0) return new Map()
        const rows = await this.tx.find(ContactMergeEntity, { where: { workspaceId, fromContactId: In([...ids]) }, take: ids.length })
        return new Map(rows.map((row) => [row.fromContactId, row.intoContactId]))
    }

    async aliasesOf(workspaceId: string, contactId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.tx.find(ContactMergeEntity, {
            where: { workspaceId, intoContactId: contactId },
            order: { createdAt: "ASC", id: "ASC" },
            take: IDENTITIES_MAX,
        })
        return rows.map((row) => row.fromContactId)
    }

    async insertMerge(workspaceId: string, from: string, into: string, reason: MergeReason, decidedBy: string | null): Promise<void> {
        await this.tx.update(ContactMergeEntity, { workspaceId, intoContactId: from }, { intoContactId: into })
        await this.tx.insert(ContactMergeEntity, { workspaceId, fromContactId: from, intoContactId: into, reason, decidedBy })
    }

    async mergeReasonOf(workspaceId: string, from: string): Promise<MergeReason | null> {
        const row = await this.tx.findOne(ContactMergeEntity, { where: { workspaceId, fromContactId: from } })
        const reason = row?.reason
        return reason === "phone_verified" || reason === "email_verified" || reason === "link_token" || reason === "member_approved"
            ? reason
            : null
    }

    async tokenOf(workspaceId: string, hash: string): Promise<StoredLinkToken | null> {
        const row = await this.tx.findOne(ContactLinkTokenEntity, { where: { workspaceId, tokenHash: hash } })
        return row === null ? null : { id: row.id, contactId: row.contactId, expiresAt: row.expiresAt, usedAt: row.usedAt }
    }

    async insertToken(workspaceId: string, contactId: string, hash: string, expiresAt: Date): Promise<void> {
        await this.tx.insert(ContactLinkTokenEntity, { workspaceId, contactId, tokenHash: hash, expiresAt })
    }

    async useToken(workspaceId: string, tokenId: string, byContactId: string, at: Date): Promise<boolean> {
        const result = await this.tx.update(
            ContactLinkTokenEntity,
            { workspaceId, id: tokenId, usedAt: IsNull() },
            { usedAt: at, usedByContactId: byContactId },
        )
        return (result.affected ?? 0) > 0
    }

    async insertEvent(workspaceId: string, event: ContactEventWrite): Promise<void> {
        const { by } = event
        await this.tx.insert(ContactEventEntity, {
            workspaceId,
            contactId: event.contactId,
            action: event.action,
            detail: { ...event.detail },
            actorKind: by.kind,
            decidedBy: decidedByOf(by),
            agentId: by.kind === "step" ? by.agentId : null,
            stepKey: by.kind === "step" ? by.stepKey : null,
        })
    }

    async page(workspaceId: string, ask: ContactsPageAsk): Promise<ReadonlyArray<Contact>> {
        const base: FindOptionsWhere<ContactEntity> = { workspaceId, state: "active" }
        const after = ask.after
        const where =
            after === null
                ? base
                : [
                      { ...base, createdAt: LessThan(new Date(after.createdAt)) },
                      { ...base, createdAt: new Date(after.createdAt), id: LessThan(after.id) },
                  ]
        const rows = await this.tx.find(ContactEntity, { where, order: { createdAt: "DESC", id: "DESC" }, take: ask.size })
        return rows.map((row) => contactOf(row))
    }

    countCreated(workspaceId: string, from: Date, to: Date): Promise<number> {
        return this.tx.count(ContactEntity, {
            where: { workspaceId, state: "active", createdAt: And(MoreThanOrEqual(from), LessThan(to)) },
        })
    }

    async byNamePrefix(workspaceId: string, prefix: string, size: number): Promise<ReadonlyArray<Contact>> {
        const rows = await this.tx.find(ContactEntity, {
            where: { workspaceId, state: "active", displayName: ILike(`${likeText(prefix.trim())}%`) },
            order: { displayName: "ASC", id: "ASC" },
            take: size,
        })
        return rows.map((row) => contactOf(row))
    }
}

@Injectable()
/** The contacts store on the primary connection: every change in one transaction. */
export class TypeormContactsStore implements ContactsStore {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Runs `work` in one database transaction and hands it the transactional contacts view. */
    transaction<T>(work: (tx: ContactsTx) => Promise<T>): Promise<T> {
        return this.entityManager.transaction((tx) => work(new TypeormContactsTx(tx)))
    }
}
