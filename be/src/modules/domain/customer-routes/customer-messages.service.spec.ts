import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { CLOCK } from "@modules/platform/clock"
import {
    CUSTOMER_LINE_STORE,
    type CustomerLine,
    type CustomerLineRows,
    type CustomerLineStore,
    type HeardLineRow,
    type LineWindowAsk,
} from "./customer-line-store.port"
import { CustomerMessagesService, HEARD_TEXT_MAX, type HearLine } from "./customer-messages.service"

const WS = "ws-1"
const NOW = new Date("2026-11-14T03:00:00.000Z")

/** The store as the table behaves: once per (route, key) for a heard line, the window newest first by said-at then insertion order. */
class MemoryLineStore implements CustomerLineStore {
    readonly rows: Array<CustomerLine> = []
    readonly asks: Array<LineWindowAsk> = []
    private seq = 0

    insertHeard(_manager: unknown, _workspaceId: string, line: HeardLineRow): Promise<{ id: string; written: boolean }> {
        const kept = this.rows.find((row) => row.direction === "from_person" && row.routeId === line.routeId && row.key === line.key)
        if (kept !== undefined) return Promise.resolve({ id: kept.id, written: false })
        this.seq += 1
        const row: CustomerLine = {
            id: `line-${String(this.seq)}`,
            seq: String(this.seq),
            routeId: line.routeId,
            contactId: line.contactId,
            direction: "from_person",
            key: line.key,
            saidAt: line.saidAt.toISOString(),
            text: line.text,
            files: line.files,
            order: null,
            eventId: line.eventId,
            agentId: null,
            memberId: null,
            runId: null,
            stepKey: null,
            state: null,
            reason: null,
            channel: line.channel,
            accountId: line.accountId,
            deliveredAt: null,
        }
        this.rows.push(row)
        return Promise.resolve({ id: row.id, written: true })
    }

    windowOf(_workspaceId: string, routeIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        this.asks.push(ask)
        const rows = this.rows
            .filter((row) => routeIds.includes(row.routeId))
            .toSorted((a, b) => b.saidAt.localeCompare(a.saidAt) || Number(b.seq) - Number(a.seq))
        return Promise.resolve({ rows: rows.slice(0, ask.limit), next: null })
    }

    ofContacts(_workspaceId: string, contactIds: ReadonlyArray<string>, ask: LineWindowAsk): Promise<CustomerLineRows> {
        this.asks.push(ask)
        return Promise.resolve({ rows: this.rows.filter((row) => contactIds.includes(row.contactId)).slice(0, ask.limit), next: null })
    }

    lastHeardAt(_workspaceId: string, routeId: string): Promise<Date | null> {
        const last = this.rows.filter((row) => row.routeId === routeId && row.direction === "from_person").map((row) => row.saidAt).toSorted().at(-1)
        return Promise.resolve(last === undefined ? null : new Date(last))
    }
}

const lineOf = (over: Partial<HearLine> = {}): HearLine => ({
    workspaceId: WS,
    routeId: "route-1",
    contactId: "contact-1",
    channel: "zalo",
    accountId: "conn-1",
    key: "msg-1",
    text: "Shop còn hoa hồng không?",
    at: "2026-11-14T02:59:00.000Z",
    files: [{ id: "f-1", url: "https://files.example/p.jpg", name: "p.jpg", contentType: "image/jpeg" }],
    eventId: "ev-1",
    ...over,
})

const build = async () => {
    const store = new MemoryLineStore()
    const contacts = mock<ContactsService>()
    contacts.activeId.mockImplementation((_ws, id) => Promise.resolve(id === "contact-old" ? "contact-1" : id === "contact-gone" ? null : id))
    contacts.aliasesOf.mockImplementation((_ws, id) => Promise.resolve(id === "contact-1" ? ["contact-1", "contact-old"] : [id]))
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerMessagesService,
            { provide: CUSTOMER_LINE_STORE, useValue: store },
            { provide: ContactsService, useValue: contacts },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerMessagesService), store }
}

describe("CustomerMessagesService.hear", () => {
    it("keeps the person's line once on its route, with the channel's time and the kept files by address", async () => {
        const { service, store } = await build()
        const tx = mockEntityManager()

        await expect(service.hear(tx, lineOf())).resolves.toEqual({ id: "line-1", written: true })
        await expect(service.hear(tx, lineOf())).resolves.toEqual({ id: "line-1", written: false })

        expect(store.rows).toHaveLength(1)
        expect(store.rows[0]).toMatchObject({
            direction: "from_person",
            key: "msg-1",
            saidAt: "2026-11-14T02:59:00.000Z",
            text: "Shop còn hoa hồng không?",
            files: [{ url: "https://files.example/p.jpg", name: "p.jpg", contentType: "image/jpeg" }],
            eventId: "ev-1",
        })
    })

    it("keeps a file the entry could NOT keep with its typed reason and NO address (MX-CORE D2-4: never an empty address with no reason)", async () => {
        const { service, store } = await build()
        const unread = { id: "unread:refused_400:0", url: "", name: "", contentType: "image/*", notKept: "refused_400" as const }

        await service.hear(mockEntityManager(), lineOf({ key: "msg-pic", text: "", files: [unread] }))

        const [file] = store.rows[0]?.files ?? []
        expect(file).toEqual({ url: null, name: "", contentType: "image/*", notKept: "refused_400" })
    })

    it("says a line with no channel time, an unreadable one or one ahead of the clock at the time it was received", async () => {
        const { service, store } = await build()
        const tx = mockEntityManager()

        await service.hear(tx, lineOf({ key: "a", at: null }))
        await service.hear(tx, lineOf({ key: "b", at: "not a time" }))
        await service.hear(tx, lineOf({ key: "c", at: "2026-11-15T00:00:00.000Z" }))

        expect(store.rows.map((row) => row.saidAt)).toEqual([NOW.toISOString(), NOW.toISOString(), NOW.toISOString()])
    })

    it("keeps nothing for a key that is no key, and bounds the words", async () => {
        const { service, store } = await build()
        const tx = mockEntityManager()

        await expect(service.hear(tx, lineOf({ key: "" }))).resolves.toBeNull()
        await expect(service.hear(tx, lineOf({ key: "k".repeat(201) }))).resolves.toBeNull()
        await service.hear(tx, lineOf({ key: "long", text: "x".repeat(HEARD_TEXT_MAX + 10) }))

        expect(store.rows.map((row) => row.text.length)).toEqual([HEARD_TEXT_MAX])
    })
})

describe("CustomerMessagesService reads", () => {
    it("reads one route's thread bounded, with a dotted cursor and the told filter passed through", async () => {
        const { service, store } = await build()
        await service.hear(mockEntityManager(), lineOf())

        const page = await service.threadOf(WS, "route-1", { limit: 500, after: "1763089140000.7", since: "2026-11-01T00:00:00.000Z", told: "delivered" })

        expect(page.rows).toHaveLength(1)
        expect(store.asks[0]).toEqual({
            limit: 100,
            before: { saidAt: new Date(1763089140000), seq: "7" },
            since: new Date("2026-11-01T00:00:00.000Z"),
            toldStates: ["delivered"],
        })
    })

    it("starts from the newest on a malformed cursor and reads every line on a malformed start", async () => {
        const { service, store } = await build()

        await service.threadOf(WS, "route-1", { after: "drop table", since: "yesterday" })

        expect(store.asks[0]).toEqual({ limit: 50, before: null, since: null, toldStates: null })
    })

    it("reads a person under every id merged into them", async () => {
        const { service } = await build()
        await service.hear(mockEntityManager(), lineOf({ contactId: "contact-old" }))

        const page = await service.ofContact(WS, "contact-old")

        expect(page.rows.map((row) => row.contactId)).toEqual(["contact-old"])
    })

    it("reads nothing of a deleted person: the lines stay in the store, the read does not even ask for them", async () => {
        const { service, store } = await build()
        await service.hear(mockEntityManager(), lineOf({ contactId: "contact-gone" }))

        await expect(service.ofContact(WS, "contact-gone")).resolves.toEqual({ rows: [], next: null })

        expect(store.rows).toHaveLength(1)
        expect(store.asks).toHaveLength(0)
    })

    it("answers the start of the reply window: when the person last said something on the route", async () => {
        const { service } = await build()

        await expect(service.lastHeardAt(WS, "route-1")).resolves.toBeNull()
        await service.hear(mockEntityManager(), lineOf())
        await expect(service.lastHeardAt(WS, "route-1")).resolves.toEqual(new Date("2026-11-14T02:59:00.000Z"))
    })
})
