import type {
    Contact,
    ContactIdentity,
    ContactMemoryPort,
    ContactMemoryView,
    ContactsStore,
    ContactsTx,
    IdentityKey,
    MergeReason,
    NormalIdentity,
    ContactEventWrite,
    ContactsPageAsk,
    ContactValues,
    IdentityWrite,
    StoredLinkToken,
} from "@modules/domain/contacts"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"

/** The workspace of the contacts doubles. */
export const CONTACTS_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** Another workspace: nothing of it ever meets the first. */
export const OTHER_WORKSPACE = "22222222-2222-4222-8222-222222222222"

const keyText = (key: IdentityKey): string => `${key.kind}|${key.provider}|${key.account}|${key.value}`
const view = (row: StoredContact): Contact => ({ ...row, tags: [...row.tags] })

interface MergeRow {
    readonly workspaceId: string
    readonly from: string
    into: string
    readonly reason: MergeReason
    readonly decidedBy: string | null
}

interface TokenRow extends StoredLinkToken {
    readonly workspaceId: string
    readonly hash: string
    usedBy: string | null
    used: Date | null
}

interface StoredContact {
    readonly id: string
    readonly workspaceId: string
    displayName: string | null
    tags: Array<string>
    state: Contact["state"]
    readonly createdAt: string
    updatedAt: string
    erasedAt: Date | null
}

/**
 * The contacts store in memory, as the TypeORM store behaves (exact keys, one verified holder per identity, flat redirects), so the
 * service is specced on real behaviour. `transaction` runs the work on the same rows; a throw keeps what was written before it (the
 * specs never rely on a rollback).
 */
export class MemoryContactsStore implements ContactsStore {
    readonly contacts: Array<StoredContact> = []
    readonly identities: Array<ContactIdentity & { readonly workspaceId: string }> = []
    /** The ids of the identities marked deleted with their contact: they stay in `identities` and every read leaves them out. */
    readonly hidden = new Set<string>()
    readonly merges: Array<MergeRow> = []
    readonly tokens: Array<TokenRow> = []
    readonly events: Array<ContactEventWrite & { readonly workspaceId: string }> = []
    private next = 1
    private tick = 0

    private id(): string {
        const n = String(this.next++).padStart(12, "0")
        return `00000000-0000-4000-8000-${n}`
    }

    private at(): string {
        this.tick += 1
        return new Date(Date.UTC(2026, 10, 1, 0, 0, this.tick)).toISOString()
    }

    /** Adds a contact as it would have been met before the spec. */
    seed(workspaceId: string, displayName: string | null, identities: ReadonlyArray<NormalIdentity> = []): string {
        const at = this.at()
        const id = this.id()
        this.contacts.push({ id, workspaceId, displayName, tags: [], state: "active", createdAt: at, updatedAt: at, erasedAt: null })
        for (const identity of identities) {
            this.identities.push({
                ...identity,
                id: this.id(),
                workspaceId,
                contactId: id,
                verified: identity.proof !== null,
                verifiedBy: identity.proof,
                source: "channel",
                joinedBy: null,
                at,
            })
        }
        return id
    }

    transaction<T>(work: (tx: ContactsTx) => Promise<T>): Promise<T> {
        return work(this.tx())
    }

    private tx(): ContactsTx {
        const activeIds = (workspaceId: string): ReadonlySet<string> =>
            new Set(this.contacts.filter((one) => one.workspaceId === workspaceId && one.state === "active").map((one) => one.id))
        return {
            contactsOf: (workspaceId, ids) =>
                Promise.resolve(this.contacts.filter((one) => one.workspaceId === workspaceId && ids.includes(one.id)).map((row) => view(row))),
            insertContact: (workspaceId, displayName) => {
                const at = this.at()
                const row: StoredContact = { id: this.id(), workspaceId, displayName, tags: [], state: "active", createdAt: at, updatedAt: at, erasedAt: null }
                this.contacts.push(row)
                return Promise.resolve(view(row))
            },
            updateContact: (workspaceId, id, values: ContactValues) => {
                const row = this.contacts.find((one) => one.workspaceId === workspaceId && one.id === id)
                if (row !== undefined) {
                    if (values.displayName !== undefined) row.displayName = values.displayName
                    if (values.tags !== undefined) row.tags = [...values.tags]
                    if (values.state !== undefined) row.state = values.state
                    row.updatedAt = this.at()
                }
                return Promise.resolve()
            },
            identitiesOf: (workspaceId, contactIds) =>
                Promise.resolve(
                    this.identities
                        .filter((one) => one.workspaceId === workspaceId && contactIds.includes(one.contactId) && !this.hidden.has(one.id))
                        .toSorted((a, b) => a.at.localeCompare(b.at)),
                ),
            matchesOf: (workspaceId, keys) => {
                const wanted = new Set(keys.map((key) => keyText(key)))
                const active = activeIds(workspaceId)
                return Promise.resolve(
                    this.identities
                        .filter(
                            (one) =>
                                one.workspaceId === workspaceId && !this.hidden.has(one.id) && active.has(one.contactId) && wanted.has(keyText(one)),
                        )
                        .map((one) => ({
                            key: { kind: one.kind, provider: one.provider, account: one.account, value: one.value },
                            contactId: one.contactId,
                            workspaceId,
                            verified: one.verified,
                            contactCreatedAt: this.contacts.find((row) => row.id === one.contactId)?.createdAt ?? "",
                        })),
                )
            },
            namesOf: (workspaceId, name) =>
                Promise.resolve(
                    this.contacts
                        .filter(
                            (one) =>
                                one.workspaceId === workspaceId &&
                                one.state === "active" &&
                                one.displayName?.trim().toLowerCase() === name.trim().toLowerCase(),
                        )
                        .map((one) => ({ contactId: one.id, workspaceId })),
                ),
            putIdentity: (workspaceId, contactId, identity, source, joinedBy): Promise<IdentityWrite> => {
                const same = this.identities.filter(
                    (one) => one.workspaceId === workspaceId && !this.hidden.has(one.id) && keyText(one) === keyText(identity),
                )
                if (identity.proof !== null && same.some((one) => one.verified && one.contactId !== contactId)) return Promise.resolve("taken")
                const mine = same.find((one) => one.contactId === contactId)
                if (mine !== undefined) {
                    if (identity.proof !== null && !mine.verified) {
                        const at = this.identities.indexOf(mine)
                        this.identities[at] = { ...mine, verified: true, verifiedBy: identity.proof }
                    }
                    return Promise.resolve("held")
                }
                this.identities.push({
                    kind: identity.kind,
                    provider: identity.provider,
                    account: identity.account,
                    value: identity.value,
                    id: this.id(),
                    workspaceId,
                    contactId,
                    verified: identity.proof !== null,
                    verifiedBy: identity.proof,
                    source,
                    joinedBy,
                    at: this.at(),
                })
                return Promise.resolve("held")
            },
            moveIdentities: (workspaceId, from, into, joinedBy) => {
                const kept = new Map(
                    this.identities.filter((one) => one.workspaceId === workspaceId && one.contactId === into).map((one) => [keyText(one), one]),
                )
                for (const one of this.identities.filter((row) => row.workspaceId === workspaceId && row.contactId === from)) {
                    const at = this.identities.indexOf(one)
                    const twin = kept.get(keyText(one))
                    if (twin === undefined) this.identities[at] = { ...one, contactId: into, joinedBy }
                    else {
                        if (one.verified && !twin.verified) {
                            const twinAt = this.identities.indexOf(twin)
                            this.identities[twinAt] = { ...twin, verified: true, verifiedBy: one.verifiedBy }
                        }
                        this.identities.splice(at, 1)
                    }
                }
                return Promise.resolve()
            },
            deleteIdentity: (workspaceId, contactId, identityId) => {
                const at = this.identities.findIndex((one) => one.workspaceId === workspaceId && one.contactId === contactId && one.id === identityId)
                if (at < 0) return Promise.resolve(null)
                const [gone] = this.identities.splice(at, 1)
                return Promise.resolve(gone ?? null)
            },
            eraseContacts: (workspaceId, contactIds, at) => {
                for (const row of this.contacts)
                    if (row.workspaceId === workspaceId && contactIds.includes(row.id) && row.erasedAt === null) {
                        row.state = "erased"
                        row.erasedAt = at
                    }
                let marked = 0
                for (const one of this.identities)
                    if (one.workspaceId === workspaceId && contactIds.includes(one.contactId) && !this.hidden.has(one.id)) {
                        this.hidden.add(one.id)
                        marked += 1
                    }
                return Promise.resolve(marked)
            },
            redirectsOf: (workspaceId, ids) =>
                Promise.resolve(
                    new Map(this.merges.filter((one) => one.workspaceId === workspaceId && ids.includes(one.from)).map((one) => [one.from, one.into])),
                ),
            aliasesOf: (workspaceId, contactId) =>
                Promise.resolve(this.merges.filter((one) => one.workspaceId === workspaceId && one.into === contactId).map((one) => one.from)),
            insertMerge: (workspaceId, from, into, reason, decidedBy) => {
                for (const one of this.merges) if (one.workspaceId === workspaceId && one.into === from) one.into = into
                this.merges.push({ workspaceId, from, into, reason, decidedBy })
                return Promise.resolve()
            },
            mergeReasonOf: (workspaceId, from) =>
                Promise.resolve(this.merges.find((one) => one.workspaceId === workspaceId && one.from === from)?.reason ?? null),
            tokenOf: (workspaceId, hash) => {
                const row = this.tokens.find((one) => one.workspaceId === workspaceId && one.hash === hash)
                return Promise.resolve(row === undefined ? null : { id: row.id, contactId: row.contactId, expiresAt: row.expiresAt, usedAt: row.used })
            },
            insertToken: (workspaceId, contactId, hash, expiresAt) => {
                this.tokens.push({ id: this.id(), workspaceId, contactId, hash, expiresAt, usedAt: null, used: null, usedBy: null })
                return Promise.resolve()
            },
            useToken: (workspaceId, tokenId, byContactId, at) => {
                const row = this.tokens.find((one) => one.workspaceId === workspaceId && one.id === tokenId)
                if (row?.used !== null) return Promise.resolve(false)
                row.used = at
                row.usedBy = byContactId
                return Promise.resolve(true)
            },
            insertEvent: (workspaceId, event) => {
                this.events.push({ ...event, workspaceId })
                return Promise.resolve()
            },
            page: (workspaceId, ask: ContactsPageAsk) => {
                const rows = this.contacts
                    .filter((one) => one.workspaceId === workspaceId && one.state === "active")
                    .toSorted((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)))
                const after = ask.after
                const start = after === null ? 0 : rows.findIndex((one) => one.id === after.id) + 1
                return Promise.resolve(rows.slice(start, start + ask.size).map((row) => view(row)))
            },
            countCreated: (workspaceId, from, to) =>
                Promise.resolve(
                    this.contacts.filter(
                        (one) =>
                            one.workspaceId === workspaceId &&
                            one.state === "active" &&
                            one.createdAt >= from.toISOString() &&
                            one.createdAt < to.toISOString(),
                    ).length,
                ),
            byNamePrefix: (workspaceId, prefix, size) =>
                Promise.resolve(
                    this.contacts
                        .filter(
                            (one) =>
                                one.workspaceId === workspaceId &&
                                one.state === "active" &&
                                (one.displayName ?? "").toLowerCase().startsWith(prefix.trim().toLowerCase()),
                        )
                        .slice(0, size)
                        .map((row) => view(row)),
                ),
        }
    }
}

/** The contact memory in memory: facts and notes per contact id. */
export class MemoryContactMemory implements ContactMemoryPort {
    readonly facts = new Map<string, Record<string, JsonValue>>()

    read(_workspaceId: string, contactId: string): Promise<ContactMemoryView> {
        return Promise.resolve({ facts: { ...this.facts.get(contactId) }, notes: [] })
    }

    remember(_workspaceId: string, contactId: string, facts: Readonly<Record<string, JsonValue>>): Promise<void> {
        this.facts.set(contactId, { ...this.facts.get(contactId), ...facts })
        return Promise.resolve()
    }

    forget(_workspaceId: string, contactId: string, names: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const held = this.facts.get(contactId) ?? {}
        const gone = names.filter((name) => Object.hasOwn(held, name))
        this.facts.set(contactId, Object.fromEntries(Object.entries(held).filter(([name]) => !names.includes(name))))
        return Promise.resolve(gone)
    }

    rekey(_workspaceId: string, from: string, into: string): Promise<void> {
        this.facts.set(into, { ...this.facts.get(from), ...this.facts.get(into) })
        this.facts.delete(from)
        return Promise.resolve()
    }
}
