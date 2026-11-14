import { CONTACTS_WORKSPACE as WS, MemoryContactMemory, MemoryContactsStore } from "@tests/fixtures/builders/contacts.builder"
import type { ContactRecordsErasure, ContactRecordsPort } from "./contact-records.port"
import type { ContactActor } from "./contacts.contracts"
import { ContactsService } from "./contacts.service"
import { RecordContactsAdapter } from "./record-contacts.adapter"

const NOW = new Date("2026-11-13T08:00:00.000Z")
const MEMBER: ContactActor = { kind: "member", memberId: "member-1" }
const APPROVED: ContactActor = { kind: "step", agentId: "agent-1", stepKey: "s1", approvedBy: "member-1" }

const zaloOf = (userId: string) => ({ channel: "zalo", account: "zalo-1", userId, name: "Lan" })

const recordsOf = (erasure: ContactRecordsErasure): ContactRecordsPort & { readonly erase: jest.Mock } => ({
    recordsOf: jest.fn(() => Promise.resolve([])),
    erase: jest.fn(() => Promise.resolve(erasure)),
})

const build = (records?: ContactRecordsPort) => {
    const store = new MemoryContactsStore()
    const memory = new MemoryContactMemory()
    const contacts = new ContactsService(store, { now: () => NOW }, memory, records)
    return { store, memory, contacts }
}

describe("ContactsService.delete erases the records that point at the contact first", () => {
    it("asks the records store to erase the records of the contact and of every id merged into it, then erases the contact", async () => {
        const records = recordsOf({ kind: "erased", records: 3, cleared: 1 })
        const { contacts } = build(records)
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        const twin = await contacts.meetChannel(WS, zaloOf("z-2"))
        await contacts.merge(WS, { into: lan, from: twin, by: APPROVED })

        await expect(contacts.delete(WS, lan, MEMBER)).resolves.toMatchObject({
            kind: "erased",
            identities: 2,
            records: 3,
            cleared: 1,
        })
        expect(records.erase).toHaveBeenCalledWith(WS, [lan, twin])
    })

    it("refuses (records_blocked) and changes nothing when a restrict ref keeps a record of the contact", async () => {
        const { contacts, store } = build(recordsOf({ kind: "blocked", relation: "order" }))
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))

        await expect(contacts.delete(WS, lan, MEMBER)).resolves.toEqual({ kind: "refused", reason: "records_blocked" })
        expect(store.contacts.find((one) => one.id === lan)).toMatchObject({ state: "active" })
        expect(store.identities).toHaveLength(1)
    })
})

describe("RecordContactsAdapter: the contacts the records store proves a contact field against", () => {
    it("answers the id an active contact stands for now, through its merge, and leaves out unknown and erased ids", async () => {
        const { contacts, store } = build()
        const lan = await contacts.meetChannel(WS, zaloOf("z-1"))
        const twin = await contacts.meetChannel(WS, zaloOf("z-2"))
        const gone = await contacts.meetChannel(WS, zaloOf("z-3"))
        await contacts.merge(WS, { into: lan, from: twin, by: APPROVED })
        await contacts.delete(WS, gone, MEMBER)
        const adapter = new RecordContactsAdapter(store)
        const unknown = "99999999-9999-4999-8999-999999999999"

        await expect(adapter.currentOf(WS, [lan, twin, gone, unknown, "not-a-uuid"])).resolves.toEqual(
            new Map([
                [lan, lan],
                [twin, lan],
            ]),
        )
        await expect(adapter.aliasesOf(WS, [lan, twin])).resolves.toEqual(
            new Map([
                [lan, [lan, twin]],
                [twin, [lan, twin]],
            ]),
        )
    })
})
