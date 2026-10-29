import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InboxService } from "./inbox.service"
import { InboxEntity } from "./persistence/entities"

/** A manager whose insert builder answers `raw` the way `ON CONFLICT DO NOTHING ... RETURNING` does. */
const managerAnswering = (raw: ReadonlyArray<unknown>) => {
    const insert = fakeQueryBuilder({ execute: { raw } })
    const manager = mockEntityManager()
    manager.createQueryBuilder.mockReturnValue(insert.builder as never)
    return { manager, insert }
}

const build = async (raw: ReadonlyArray<unknown> = [{ delivery_id: "evt-1" }]) => {
    const primary = managerAnswering(raw)
    const moduleRef = await Test.createTestingModule({
        providers: [InboxService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary.manager }],
    }).compile()
    return { inbox: moduleRef.get(InboxService), ...primary }
}

describe("InboxService", () => {
    it("accepts a delivery so the domain row can record it", async () => {
        const { inbox, manager, insert } = await build()
        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(true)
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(manager.createQueryBuilder).toHaveBeenCalledWith(InboxEntity, "i")
        expect(insert.callsOf("insert")).toEqual([[]])
        expect(insert.callsOf("values")).toEqual([[{ source: "zalo", deliveryId: "evt-1" }]])
        expect(insert.callsOf("orIgnore")).toHaveLength(1)
        expect(insert.callsOf("returning")).toEqual([["delivery_id"]])
    })

    it("refuses an already claimed delivery", async () => {
        const { inbox } = await build([])
        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(false)
    })

    it("claims a domain action through its transaction instead of the primary manager", async () => {
        const { inbox, manager } = await build()
        const transaction = managerAnswering([{ delivery_id: "hold-1" }])
        await expect(inbox.claim("work.held", "hold-1", transaction.manager as EntityManager)).resolves.toBe(true)
        expect(transaction.insert.callsOf("values")).toEqual([[{ source: "work.held", deliveryId: "hold-1" }]])
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a domain action already claimed in the caller transaction", async () => {
        const { inbox, manager } = await build()
        const transaction = managerAnswering([])
        await expect(inbox.claim("work.held", "hold-1", transaction.manager as EntityManager)).resolves.toBe(false)
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it.each([
        ["", "evt-1"],
        ["zalo", ""],
        ["zalo", "   "],
    ])("refuses an incomplete delivery key (%s, %s)", async (source, eventId) => {
        const { inbox, manager } = await build()
        await expect(inbox.claim(source, eventId)).resolves.toBe(false)
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })

    class ReceiptStub {}

    it("records the provider receipt row through the caller transaction", async () => {
        const { inbox, manager } = await build()
        const transaction = managerAnswering([{ id: "receipt-1" }])
        const row = { provider: "zalo", deliveryId: "evt-1", payload: { text: "hello" } }
        await expect(
            inbox.claimRow("zalo", "evt-1", transaction.manager as EntityManager, { entity: ReceiptStub, row }),
        ).resolves.toBe(true)
        expect(transaction.manager.createQueryBuilder).toHaveBeenCalledWith(ReceiptStub, "e")
        expect(transaction.insert.callsOf("insert")).toEqual([[]])
        expect(transaction.insert.callsOf("values")).toEqual([[row]])
        expect(transaction.insert.callsOf("returning")).toEqual([["id"]])
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("records the raw provider receipt through the caller transaction while capabilities still pass SQL", async () => {
        const { inbox } = await build()
        const transaction = mockEntityManager({ query: ["INSERT receipt", [{ id: "receipt-1" }]] })
        const receipt = { insert: "INSERT receipt" as never, payload: { text: "hello" } }
        await expect(inbox.claim("zalo", "evt-1", transaction, receipt)).resolves.toBe(true)
        expect(transaction.query).toHaveBeenCalledWith("INSERT receipt", ["zalo", "evt-1", '{"text":"hello"}'])
    })

    it("refuses a duplicate provider receipt", async () => {
        const { inbox } = await build()
        const transaction = managerAnswering([])
        await expect(
            inbox.claimRow("zalo", "evt-1", transaction.manager as EntityManager, { entity: ReceiptStub, row: {} }),
        ).resolves.toBe(false)
    })

    it("refuses an incomplete delivery key for a provider receipt", async () => {
        const { inbox, manager } = await build()
        const transaction = managerAnswering([{ id: "receipt-1" }])
        await expect(
            inbox.claimRow("", "evt-1", transaction.manager as EntityManager, { entity: ReceiptStub, row: {} }),
        ).resolves.toBe(false)
        expect(transaction.manager.createQueryBuilder).not.toHaveBeenCalled()
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("requires a transaction for a raw provider receipt", async () => {
        const { inbox, manager } = await build()
        await expect(
            inbox.claim("zalo", "evt-1", undefined, { insert: "INSERT receipt" as never, payload: {} }),
        ).resolves.toBe(false)
        expect(manager.createQueryBuilder).not.toHaveBeenCalled()
    })
})
