import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ContactEntity } from "@modules/domain/contacts/persistence/entities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DeliveryClaim } from "./channel-delivery-store.port"
import { TypeormChannelDeliveryStore } from "./channel-delivery-store.typeorm"
import { CustomerMessageEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const CLAIM: DeliveryClaim = {
    sendKey: "k1",
    routeId: "r1",
    contactId: "c1",
    agentId: "a1",
    runId: null,
    stepKey: null,
    text: "hello",
    attachmentCount: 0,
    attachmentKinds: [],
    channel: "telegram",
    accountId: null,
}

const rowOf = (seq: number): CustomerMessageEntity =>
    Object.assign(new CustomerMessageEntity(), {
        id: `d${String(seq)}`,
        seq: String(seq),
        workspaceId: WS,
        direction: "to_person",
        lineKey: `k${String(seq)}`,
        saidAt: new Date("2026-11-13T10:00:00.000Z"),
        files: [],
        orderCard: null,
        eventId: null,
        memberId: null,
        routeId: "r1",
        contactId: "c1",
        agentId: "a1",
        runId: null,
        stepKey: null,
        text: "hello",
        attachmentCount: 0,
        attachmentKinds: [],
        state: "delivered",
        reason: null,
        providerMessageId: "m1",
        channel: "telegram",
        accountId: null,
        deliveredAt: new Date("2026-11-13T10:00:01.000Z"),
        createdAt: new Date("2026-11-13T10:00:00.000Z"),
    })

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormChannelDeliveryStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormChannelDeliveryStore), em }
}

describe("TypeormChannelDeliveryStore writes", () => {
    it("claims a send key through an insert-or-nothing and answers whether this call wrote it", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "d1" }] } }, { execute: { raw: [] } }])

        await expect(store.insertClaimed(WS, CLAIM)).resolves.toBe(true)
        await expect(store.insertClaimed(WS, CLAIM)).resolves.toBe(false)

        expect(em.createQueryBuilder).toHaveBeenCalledWith(CustomerMessageEntity, "line")
        expect(fake?.callsOf("orIgnore")).toHaveLength(1)
        expect(fake?.callsOf("values")[0]).toEqual([expect.objectContaining({ workspaceId: WS, direction: "to_person", lineKey: "k1", state: "claimed", deliveredAt: null, files: [], memberId: null, orderCard: null })])
    })

    it("keeps the sent line whole: the files by address, the order card and the member who typed it", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "d1" }] } }])
        const files = [{ url: "https://files.example/qr.png", name: "qr.png", contentType: "image/png", caption: "QR" }]
        const order = { orderNo: "DH-7", lines: [], amountText: "120.000 đ", address: "", paid: false }

        await store.insertClaimed(WS, { ...CLAIM, attachmentCount: 1, attachmentKinds: ["image"], files, order, memberId: "m-1" })

        expect(fake?.callsOf("values")[0]).toEqual([
            expect.objectContaining({ files, orderCard: order, memberId: "m-1", attachmentCount: 1, attachmentKinds: ["image"] }),
        ])
    })

    it("takes back only a REFUSED row, in one conditional statement", async () => {
        const { store, em } = await build()
        em.update.mockResolvedValueOnce({ affected: 1, raw: [], generatedMaps: [] }).mockResolvedValueOnce({ affected: 0, raw: [], generatedMaps: [] })

        await expect(store.reclaim(WS, "k1")).resolves.toBe(true)
        await expect(store.reclaim(WS, "k1")).resolves.toBe(false)

        expect(em.update).toHaveBeenCalledWith(
            CustomerMessageEntity,
            { workspaceId: WS, direction: "to_person", lineKey: "k1", state: "refused" },
            { state: "claimed", reason: null },
        )
    })

    it("settles a row that is not delivered, never a delivered one", async () => {
        const { store, em } = await build()
        em.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] })

        await expect(store.settle(WS, "k1", { state: "refused", reason: "outside_window", providerMessageId: null, deliveredAt: null })).resolves.toBe(true)

        const [entity, where, values] = em.update.mock.calls[0] ?? []
        expect(entity).toBe(CustomerMessageEntity)
        expect(JSON.stringify(where)).toContain('"claimed","refused","unknown"')
        expect(JSON.stringify(where)).not.toContain('"delivered"')
        expect(values).toEqual({ state: "refused", reason: "outside_window", providerMessageId: null, deliveredAt: null })
    })
})

const LIVE_JOIN = "contact.id = line.contactId AND contact.workspaceId = line.workspaceId AND contact.erasedAt IS NULL " +
    `AND NOT EXISTS (SELECT 1 FROM public.connections removed WHERE removed.id = line.accountId AND removed.deleted_at IS NOT NULL)`

describe("TypeormChannelDeliveryStore reads", () => {
    it("reads a row by its send key inside the workspace, WITHOUT the live-contact join: the fence is the unique index, not a thread read", async () => {
        const { store, em } = await build()
        em.findOne.mockResolvedValue(rowOf(1))

        await expect(store.byKey(WS, "k1")).resolves.toMatchObject({ sendKey: "k1", state: "delivered", deliveredAt: "2026-11-13T10:00:01.000Z" })
        expect(em.findOne).toHaveBeenCalledWith(CustomerMessageEntity, { where: { workspaceId: WS, direction: "to_person", lineKey: "k1" } })
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("pages one route newest first under the live-contact join: one row more than asked says another page follows, the cursor is the last row seq", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [rowOf(9), rowOf(8), rowOf(7)] }])

        const page = await store.ofRoute(WS, "r1", 2, null)

        expect(page.rows.map((row) => row.seq)).toEqual(["9", "8"])
        expect(page.next).toBe("8")
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(["line.direction = 'to_person'", "line.routeId = :routeId"])
        expect(fake?.callsOf("orderBy")[0]).toEqual(["line.seq", "DESC"])
        expect(fake?.callsOf("limit")[0]).toEqual([3])
    })

    it("reads the rows of one run step newest first under the live-contact join, whatever their state, bounded", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [rowOf(9), rowOf(8)] }])

        const rows = await store.ofStep(WS, "run-1", "answer", 5)

        expect(rows.map((row) => row.seq)).toEqual(["9", "8"])
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(
            expect.arrayContaining(["line.runId = :runId", "line.stepKey = :stepKey"]),
        )
        expect(fake?.callsOf("limit")[0]).toEqual([5])
    })

    it("ends the pages when no row follows, reads on under the cursor, and reads nothing for no contact", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [rowOf(7)] }])

        const page = await store.ofContacts(WS, ["c1", "c0"], 2, "8")
        await expect(store.ofContacts(WS, [], 2, null)).resolves.toEqual({ rows: [], next: null })

        expect(page.next).toBeNull()
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(
            expect.arrayContaining(["line.contactId IN (:...contactIds)", "line.seq < :after"]),
        )
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("answers an unreadable state as an outcome nobody knows, never as delivered", async () => {
        const { store, em } = await build()
        em.findOne.mockResolvedValue(Object.assign(rowOf(1), { state: "weird" }))

        await expect(store.byKey(WS, "k1")).resolves.toMatchObject({ state: "unknown" })
    })
})

describe("TypeormChannelDeliveryStore counts (a deleted contact's lines are not counted)", () => {
    const FROM = new Date("2026-11-01T00:00:00.000Z")
    const TO = new Date("2026-11-08T00:00:00.000Z")

    it("counts the rows delivered in a half-open window of the workspace, under the live-contact join", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getCount: 12 }])

        await expect(store.countDelivered(WS, FROM, TO)).resolves.toBe(12)

        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("andWhere").map((call) => call[0])).toEqual(
            expect.arrayContaining(["line.state = 'delivered'", "line.deliveredAt >= :from AND line.deliveredAt < :to"]),
        )
    })

    it("counts the distinct routes of the rows delivered in the window, in one statement under the live-contact join", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getRawOne: { total: "5" } }])

        await expect(store.countRoutesTold(WS, FROM, TO)).resolves.toBe(5)

        expect(fake?.callsOf("select")[0]).toEqual(["COUNT(DISTINCT line.routeId)", "total"])
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
    })
})
