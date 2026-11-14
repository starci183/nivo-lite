import {
    CONTACTS_WORKSPACE as WS,
    MemoryContactMemory,
    MemoryContactsStore,
} from "@tests/fixtures/builders/contacts.builder"
import type { EntityManager } from "typeorm"
import type { ContactRunsPort } from "./contact-runs.port"
import type { ContactActor } from "./contacts.contracts"
import type { ContactsTx } from "./contacts-store.port"
import { ContactsService } from "./contacts.service"

const NOW = new Date("2026-11-13T08:00:00.000Z")
const MEMBER: ContactActor = { kind: "member", memberId: "member-1" }
const STEP: ContactActor = { kind: "step", agentId: "agent-1", stepKey: "s1", approvedBy: null }

const build = () => {
    const store = new MemoryContactsStore()
    const memory = new MemoryContactMemory()
    const contacts = new ContactsService(store, { now: () => NOW }, memory)
    return { store, memory, contacts }
}

const zaloOf = (userId: string) => ({ channel: "zalo", account: "zalo-1", userId, name: "Lan" })

describe("ContactsService.delete: a soft delete, nothing is removed (owner ruling R31)", () => {
    it("marks the contact and every merged alias deleted and keeps their identities, name, tags and memory in the store", async () => {
        const { contacts, store, memory } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        const twin = await contacts.meetChannel(WS, zaloOf("z-2"))
        await contacts.merge(WS, { into: lan, from: twin, by: { ...STEP, approvedBy: "member-1" } })
        await contacts.update(WS, lan, { displayName: "Lan", tags: ["vip"] }, MEMBER)
        await memory.remember(WS, lan, { address: "12 L\u00ea L\u1ee3i" })

        await expect(contacts.delete(WS, lan, MEMBER)).resolves.toEqual({
            kind: "erased",
            identities: 2,
            records: 0,
            cleared: 0,
        })

        expect(store.contacts.map((one) => [one.id, one.state, one.erasedAt])).toEqual([
            [lan, "erased", NOW],
            [twin, "erased", NOW],
        ])
        expect(store.contacts.find((one) => one.id === lan)).toMatchObject({ displayName: "Lan", tags: ["vip"] })
        expect(store.identities).toHaveLength(2)
        expect([...store.hidden]).toHaveLength(2)
        expect(memory.facts.get(lan)).toEqual({ address: "12 L\u00ea L\u1ee3i" })
        expect(store.events).toContainEqual(expect.objectContaining({ contactId: lan, action: "erased" }))
    })

    it("then get, list, search, memory and exact lookups find nothing of the deleted contact", async () => {
        const { contacts, store, memory } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        await contacts.linkIdentity(WS, lan, { kind: "phone", value: "0912345678", proof: "member" }, MEMBER)
        await contacts.update(WS, lan, { displayName: "Lan" }, MEMBER)
        await memory.remember(WS, lan, { address: "12 L\u00ea L\u1ee3i" })
        await contacts.delete(WS, lan, MEMBER)

        await expect(contacts.get(WS, lan)).resolves.toBeNull()
        await expect(contacts.activeId(WS, lan)).resolves.toBeNull()
        await expect(contacts.list(WS, null, 10)).resolves.toEqual([])
        await expect(contacts.search(WS, "0912345678", 10)).resolves.toEqual([])
        await expect(contacts.search(WS, "lan", 10)).resolves.toEqual([])
        await expect(
            contacts.contactOfChannel(WS, { channel: "zalo", account: "zalo-1", userId: "z-1" }),
        ).resolves.toBeNull()
        await expect(contacts.memoryOf(WS, lan, "display")).resolves.toEqual({ facts: {}, notes: [] })
        await expect(contacts.countCreated(WS, new Date(0), new Date("2027-01-01T00:00:00.000Z"))).resolves.toBe(0)
        expect(store.contacts).toHaveLength(1)
    })

    it("answers contact_missing to an update, an identity link, a forget and a second delete of a deleted contact", async () => {
        const { contacts } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        await contacts.delete(WS, lan, MEMBER)

        await expect(contacts.update(WS, lan, { displayName: "Lan" }, MEMBER)).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
        await expect(
            contacts.linkIdentity(WS, lan, { kind: "phone", value: "0912345678", proof: "member" }, MEMBER),
        ).resolves.toMatchObject({
            kind: "refused",
            reason: "contact_missing",
        })
        await expect(contacts.forget(WS, lan, ["address"], MEMBER)).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
        await expect(contacts.delete(WS, lan, MEMBER)).resolves.toEqual({ kind: "refused", reason: "contact_missing" })
    })

    it("meets the same channel id written again as a NEW contact holding a new identity; the deleted contact keeps its own", async () => {
        const { contacts, store } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        await contacts.delete(WS, lan, MEMBER)

        const again = await contacts.meetChannel(WS, zaloOf("z-1"))

        expect(again).not.toBe(lan)
        expect(store.identities.filter((one) => one.value === "z-1").map((one) => one.contactId)).toEqual([lan, again])
        await expect(
            contacts.contactOfChannel(WS, { channel: "zalo", account: "zalo-1", userId: "z-1" }),
        ).resolves.toBe(again)
        await expect(contacts.get(WS, again)).resolves.toMatchObject({
            identities: [expect.objectContaining({ value: "z-1", verified: true })],
        })
    })

    it("refuses to merge a deleted contact with a live one, either way, and leaves both as they stand", async () => {
        const { contacts, store } = build()
        const gone = await contacts.meetChannel(WS, zaloOf("z-1"))
        const live = await contacts.meetChannel(WS, zaloOf("z-2"))
        await contacts.delete(WS, gone, MEMBER)
        const approved = { ...STEP, approvedBy: "member-1" }

        await expect(contacts.merge(WS, { into: live, from: gone, by: approved })).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
        await expect(contacts.merge(WS, { into: gone, from: live, by: approved })).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
        expect(store.merges).toHaveLength(0)
        expect(store.contacts.find((one) => one.id === live)).toMatchObject({ state: "active" })
    })

    it("lets the new contact prove an identity the deleted one held verified (the old one no longer counts as a holder)", async () => {
        const { contacts } = build()
        const old = await contacts.meetChannel(WS, zaloOf("z-1"))
        await contacts.linkIdentity(WS, old, { kind: "phone", value: "0912345678", proof: "member" }, MEMBER)
        await contacts.delete(WS, old, MEMBER)
        const fresh = await contacts.meetChannel(WS, zaloOf("z-9"))

        await expect(
            contacts.linkIdentity(WS, fresh, { kind: "phone", value: "0912345678", proof: "member" }, MEMBER),
        ).resolves.toMatchObject({ kind: "linked" })
    })
})

/** The database transaction the memory store stands for: the one object the runs port must be handed (ruling R37). */
const TX = { name: "the deletion's transaction" } as unknown as EntityManager

/** The memory store, each transaction carrying `TX` as its database transaction, and a runs port that records what it saw. */
const buildWithRuns = () => {
    const store = new MemoryContactsStore()
    const inner = store.transaction.bind(store)
    store.transaction = <T>(work: (tx: ContactsTx) => Promise<T>): Promise<T> =>
        inner((tx) => work(Object.assign(Object.create(tx) as ContactsTx, { manager: TX })))
    const seen: Array<{
        readonly tx: EntityManager
        readonly ids: ReadonlyArray<string>
        readonly liveAtCall: ReadonlyArray<string>
    }> = []
    const runs: ContactRunsPort = {
        erasing: (tx, _workspace, ids) => {
            seen.push({
                tx,
                ids,
                liveAtCall: store.contacts.filter((one) => one.state === "active").map((one) => one.id),
            })
            return Promise.resolve(1)
        },
    }
    const contacts = new ContactsService(store, { now: () => NOW }, new MemoryContactMemory(), undefined, runs)
    return { store, contacts, seen }
}

describe("ContactsService.delete ends the runs parked on the person (ruling R37, CONTACT_RUNS)", () => {
    it("hands the runs port every id of the person, in the deletion's own transaction, BEFORE the contacts are marked", async () => {
        const { contacts, seen } = buildWithRuns()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        const twin = await contacts.meetChannel(WS, zaloOf("z-2"))
        await contacts.merge(WS, { into: lan, from: twin, by: { ...STEP, approvedBy: "member-1" } })

        await expect(contacts.delete(WS, lan, MEMBER)).resolves.toMatchObject({ kind: "erased" })

        expect(seen).toEqual([{ tx: TX, ids: [lan, twin], liveAtCall: [lan] }])
    })

    it("asks the runs port nothing for a contact the workspace does not hold", async () => {
        const { contacts, seen } = buildWithRuns()

        await expect(contacts.delete(WS, "nobody", MEMBER)).resolves.toEqual({
            kind: "refused",
            reason: "contact_missing",
        })
        expect(seen).toEqual([])
    })
})
