import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ContactEntity } from "@modules/domain/contacts/persistence/entities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { HeardLineRow } from "./customer-line-store.port"
import { TypeormCustomerLineStore } from "./customer-line-store.typeorm"
import { CustomerMessageEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"
const SAID = new Date("2026-11-13T10:00:00.000Z")
const LIVE_JOIN = "contact.id = line.contactId AND contact.workspaceId = line.workspaceId AND contact.erasedAt IS NULL " +
    `AND NOT EXISTS (SELECT 1 FROM public.connections removed WHERE removed.id = line.accountId AND removed.deleted_at IS NOT NULL)`

const HEARD: HeardLineRow = {
    routeId: "r1",
    contactId: "c1",
    channel: "zalo",
    accountId: "conn-1",
    key: "msg-1",
    text: "Shop còn hoa hồng không?",
    saidAt: SAID,
    files: [{ url: "https://files.example/p.jpg", name: "p.jpg", contentType: "image/jpeg" }],
    eventId: "ev-1",
}

const rowOf = (seq: number, over: Partial<CustomerMessageEntity> = {}): CustomerMessageEntity =>
    Object.assign(new CustomerMessageEntity(), {
        id: `l${String(seq)}`,
        seq: String(seq),
        workspaceId: WS,
        routeId: "r1",
        contactId: "c1",
        direction: "from_person",
        lineKey: `msg-${String(seq)}`,
        saidAt: new Date(SAID.getTime() + seq * 1000),
        text: "hello",
        files: [],
        attachmentCount: 0,
        attachmentKinds: [],
        orderCard: null,
        eventId: null,
        agentId: null,
        memberId: null,
        runId: null,
        stepKey: null,
        state: null,
        reason: null,
        providerMessageId: null,
        channel: "zalo",
        accountId: "conn-1",
        deliveredAt: null,
        createdAt: SAID,
        ...over,
    })

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormCustomerLineStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormCustomerLineStore), em }
}

describe("TypeormCustomerLineStore.insertHeard", () => {
    it("writes a heard line through an insert-or-nothing in the CALLER's transaction, with no sender, state or order", async () => {
        const { store, em } = await build()
        const tx = mockEntityManager()
        const [fake] = queueQueryBuilders(tx, [{ execute: { raw: [{ id: "l1" }] } }])

        await expect(store.insertHeard(tx, WS, HEARD)).resolves.toEqual({ id: "l1", written: true })

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(tx.createQueryBuilder).toHaveBeenCalledWith(CustomerMessageEntity, "line")
        expect(fake?.callsOf("orIgnore")).toHaveLength(1)
        expect(fake?.callsOf("values")[0]).toEqual([
            expect.objectContaining({
                workspaceId: WS,
                direction: "from_person",
                lineKey: "msg-1",
                routeId: "r1",
                saidAt: SAID,
                text: "Shop còn hoa hồng không?",
                files: HEARD.files,
                attachmentCount: 1,
                eventId: "ev-1",
                state: null,
                agentId: null,
                memberId: null,
                orderCard: null,
            }),
        ])
    })

    it("answers the line kept before when the same message is heard again (the webhook and the poll): nothing is written twice", async () => {
        const { store } = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [] } }])
        tx.findOne.mockResolvedValue(rowOf(1, { id: "l-kept" }))

        await expect(store.insertHeard(tx, WS, HEARD)).resolves.toEqual({ id: "l-kept", written: false })
        expect(tx.findOne).toHaveBeenCalledWith(CustomerMessageEntity, {
            where: { workspaceId: WS, direction: "from_person", routeId: "r1", lineKey: "msg-1" },
        })
    })

    it("fails loudly when the key held no row to read back", async () => {
        const { store } = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [] } }])
        tx.findOne.mockResolvedValue(null)

        await expect(store.insertHeard(tx, WS, HEARD)).rejects.toMatchObject({ code: "CUSTOMER_ROUTES_LINE_MISSING" })
    })
})

describe("TypeormCustomerLineStore reads", () => {
    it("reads a route's window both directions newest first by said-at then insertion order, one row more than asked", async () => {
        const { store, em } = await build()
        const told = rowOf(8, { direction: "to_person", state: "delivered", agentId: "a1", lineKey: "send-8" })
        const [fake] = queueQueryBuilders(em, [{ getMany: [rowOf(9), told, rowOf(7)] }])

        const page = await store.windowOf(WS, ["r1"], { limit: 2, before: null, since: null, toldStates: null })

        expect(page.rows.map((row) => [row.direction, row.state, row.key])).toEqual([
            ["from_person", null, "msg-9"],
            ["to_person", "delivered", "send-8"],
        ])
        expect(page.next).toEqual({ saidAt: told.saidAt, seq: "8" })
        expect(fake?.callsOf("orderBy")[0]).toEqual(["line.saidAt", "DESC"])
        expect(fake?.callsOf("addOrderBy")[0]).toEqual(["line.seq", "DESC"])
        expect(fake?.callsOf("limit")[0]).toEqual([3])
    })

    it("narrows a window by the cursor, the start instant and the sent states asked (heard lines always pass)", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [] }])
        const before = { saidAt: SAID, seq: "5" }

        const page = await store.windowOf(WS, ["r1"], { limit: 10, before, since: SAID, toldStates: ["delivered"] })

        expect(page).toEqual({ rows: [], next: null })
        const wheres = fake?.callsOf("andWhere").map((call) => call[0]) ?? []
        expect(wheres).toEqual(
            expect.arrayContaining([
                "line.routeId IN (:...routeIds)",
                "line.saidAt >= :since",
                "(line.saidAt < :beforeAt OR (line.saidAt = :beforeAt AND line.seq < :beforeSeq))",
                "(line.direction = 'from_person' OR line.state IN (:...toldStates))",
            ]),
        )
    })

    it("reads nothing for no route or no contact, without a query", async () => {
        const { store, em } = await build()
        const ask = { limit: 5, before: null, since: null, toldStates: null }

        await expect(store.windowOf(WS, [], ask)).resolves.toEqual({ rows: [], next: null })
        await expect(store.ofContacts(WS, [], ask)).resolves.toEqual({ rows: [], next: null })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("answers when the person last said something on the route, from the live-contact lines only", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getOne: rowOf(3) }, { getOne: null }])

        await expect(store.lastHeardAt(WS, "r1")).resolves.toEqual(rowOf(3).saidAt)
        await expect(store.lastHeardAt(WS, "r-of-a-deleted-contact")).resolves.toBeNull()
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(["line.routeId = :routeId", "line.direction = 'from_person'"])
        expect(fake?.callsOf("orderBy")[0]).toEqual(["line.saidAt", "DESC"])
    })

    it("joins every window to a contact that is not deleted: the lines of a deleted contact stay in the table and no read returns them", async () => {
        const { store, em } = await build()
        const ask = { limit: 5, before: null, since: null, toldStates: null }
        const [byRoute, byContact] = queueQueryBuilders(em, [{ getMany: [] }, { getMany: [] }])

        await store.windowOf(WS, ["r1"], ask)
        await store.ofContacts(WS, ["c1"], ask)

        for (const fake of [byRoute, byContact]) {
            expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
            expect(fake?.callsOf("where")[0]).toEqual(["line.workspaceId = :workspaceId", { workspaceId: WS }])
        }
    })
})
