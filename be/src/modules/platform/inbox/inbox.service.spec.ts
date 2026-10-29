import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { InboxReceipt } from "./inbox.port"
import { InboxService } from "./inbox.service"
import { InboxEntity } from "./persistence/entities"

/** A provider receipt entity as a capability maps its inbox table. */
class SpecReceiptEntity {}

const build = async () => {
    const primary = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [InboxService, { provide: PRIMARY_ENTITY_MANAGER, useValue: primary }],
    }).compile()
    return { inbox: moduleRef.get(InboxService), primary }
}

describe("InboxService delivery claims", () => {
    it("accepts a delivery so the domain row can record it", async () => {
        const { inbox, primary } = await build()
        const [insert] = queueQueryBuilders(primary, [{ execute: { raw: [{ delivery_id: "evt-1" }] } }])

        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(true)

        expect(primary.createQueryBuilder).toHaveBeenCalledWith(InboxEntity, "i")
        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([[{ source: "zalo", deliveryId: "evt-1" }]])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(insert?.callsOf("returning")).toEqual([["delivery_id"]])
    })

    it("refuses an already claimed delivery", async () => {
        const { inbox, primary } = await build()
        queueQueryBuilders(primary, [{ execute: { raw: [] } }])

        await expect(inbox.claim("zalo", "evt-1")).resolves.toBe(false)
    })

    it("claims a domain action through its transaction instead of the primary manager", async () => {
        const { inbox, primary } = await build()
        const transaction = mockEntityManager()
        const [insert] = queueQueryBuilders(transaction, [{ execute: { raw: [{ delivery_id: "hold-1" }] } }])

        await expect(inbox.claim("work.held", "hold-1", transaction)).resolves.toBe(true)

        expect(insert?.callsOf("values")).toEqual([[{ source: "work.held", deliveryId: "hold-1" }]])
        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a domain action already claimed in the caller transaction", async () => {
        const { inbox, primary } = await build()
        const transaction = mockEntityManager()
        queueQueryBuilders(transaction, [{ execute: { raw: [] } }])

        await expect(inbox.claim("work.held", "hold-1", transaction)).resolves.toBe(false)

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a claim whose insert answers something other than rows", async () => {
        const { inbox, primary } = await build()
        queueQueryBuilders(primary, [{ execute: { raw: [{ delivery_id: 7 }] } }])

        await expect(inbox.claim("zalo", "evt-1")).rejects.toThrow("DATABASE_RETURNING_ROW_REJECTED")
    })

    it.each([
        ["", "evt-1"],
        ["zalo", ""],
        ["zalo", "   "],
    ])("refuses an incomplete delivery key (%s, %s)", async (source, eventId) => {
        const { inbox, primary } = await build()

        await expect(inbox.claim(source, eventId)).resolves.toBe(false)

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("InboxService provider receipts", () => {
    it("records the provider receipt row through the caller transaction", async () => {
        const { inbox, primary } = await build()
        const transaction = mockEntityManager()
        const [insert] = queueQueryBuilders(transaction, [{ execute: { raw: [{ id: "receipt-1" }] } }])
        const row = { provider: "zalo", deliveryId: "evt-1", payload: { text: "hello" } }

        await expect(
            inbox.claimRow("zalo", "evt-1", transaction, { entity: SpecReceiptEntity, row }),
        ).resolves.toBe(true)

        expect(transaction.createQueryBuilder).toHaveBeenCalledWith(SpecReceiptEntity, "e")
        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([[row]])
        expect(insert?.callsOf("returning")).toEqual([["id"]])
        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("refuses a duplicate provider receipt", async () => {
        const { inbox } = await build()
        const transaction = mockEntityManager()
        queueQueryBuilders(transaction, [{ execute: { raw: [] } }])

        await expect(
            inbox.claimRow("zalo", "evt-1", transaction, { entity: SpecReceiptEntity, row: {} }),
        ).resolves.toBe(false)
    })

    it("refuses an incomplete delivery key for a provider receipt", async () => {
        const { inbox } = await build()
        const transaction = mockEntityManager()

        await expect(
            inbox.claimRow("", "evt-1", transaction, { entity: SpecReceiptEntity, row: {} }),
        ).resolves.toBe(false)

        expect(transaction.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("records the raw provider receipt through the caller transaction while capabilities still pass SQL", async () => {
        const { inbox } = await build()
        const transaction = mockEntityManager()
        transaction.query.mockResolvedValueOnce([{ id: "receipt-1" }])
        const receipt = mock<InboxReceipt>({ payload: { text: "hello" } })

        await expect(inbox.claim("zalo", "evt-1", transaction, receipt)).resolves.toBe(true)

        expect(transaction.query).toHaveBeenCalledWith(receipt.insert, ["zalo", "evt-1", '{"text":"hello"}'])
    })

    it("requires a transaction for a raw provider receipt", async () => {
        const { inbox, primary } = await build()
        const receipt = mock<InboxReceipt>({ payload: {} })

        await expect(inbox.claim("zalo", "evt-1", undefined, receipt)).resolves.toBe(false)

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
    })
})
