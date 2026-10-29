import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { InboxService } from "./inbox.service"
import { InboxEntity } from "./persistence/entities"

/** A provider receipt entity as a capability maps its inbox table. */
class SpecReceiptEntity {}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [InboxService] }).compile()
    return moduleRef.get(InboxService)
}

describe("InboxService delivery claims", () => {
    it("claims a delivery in the caller transaction by its trimmed id", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        const [insert] = queueQueryBuilders(tx, [{ execute: { raw: [{ delivery_id: "evt-1" }] } }])

        await expect(inbox.claim("zalo", "  evt-1  ", tx)).resolves.toBe(true)

        expect(tx.createQueryBuilder).toHaveBeenCalledWith(InboxEntity, "i")
        expect(insert?.callsOf("insert")).toEqual([[]])
        expect(insert?.callsOf("values")).toEqual([[{ source: "zalo", deliveryId: "evt-1" }]])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(insert?.callsOf("returning")).toEqual([["delivery_id"]])
    })

    it("refuses an already claimed delivery", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [] } }])

        await expect(inbox.claim("zalo", "evt-1", tx)).resolves.toBe(false)
    })

    it("refuses a claim whose insert answers something other than rows", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [{ delivery_id: 7 }] } }])

        await expect(inbox.claim("zalo", "evt-1", tx)).rejects.toThrow("DATABASE_RETURNING_ROW_REJECTED")
    })

    it.each([undefined, "", "   "])("refuses the delivery id %j before claiming anything", async (eventId) => {
        const inbox = await build()
        const tx = mockEntityManager()

        await expect(inbox.claim("zalo", eventId, tx)).rejects.toThrow("DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED")

        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("InboxService provider receipts", () => {
    it("claims the trimmed delivery id, then inserts the receipt row it keys and answers its id", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        const [claim, insert] = queueQueryBuilders(tx, [
            { execute: { raw: [{ delivery_id: "evt-1" }] } },
            { execute: { raw: [{ id: "receipt-1" }] } },
        ])

        const receiptId = await inbox.claimRow("zalo", "  evt-1  ", tx, {
            entity: SpecReceiptEntity,
            row: (deliveryId) => ({ provider: "zalo", deliveryId }),
        })

        expect(receiptId).toBe("receipt-1")
        expect(claim?.callsOf("values")).toEqual([[{ source: "zalo", deliveryId: "evt-1" }]])
        expect(tx.createQueryBuilder).toHaveBeenNthCalledWith(2, SpecReceiptEntity, "receipt")
        expect(insert?.callsOf("values")).toEqual([[{ provider: "zalo", deliveryId: "evt-1" }]])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(insert?.callsOf("returning")).toEqual([["id"]])
    })

    it("inserts no receipt for a delivery already claimed", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [] } }])

        const receiptId = await inbox.claimRow("zalo", "evt-1", tx, { entity: SpecReceiptEntity, row: () => ({}) })

        expect(receiptId).toBeUndefined()
        expect(tx.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it("answers undefined when the receipt row already exists", async () => {
        const inbox = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ execute: { raw: [{ delivery_id: "evt-1" }] } }, { execute: { raw: [] } }])

        const receiptId = await inbox.claimRow("zalo", "evt-1", tx, { entity: SpecReceiptEntity, row: () => ({}) })

        expect(receiptId).toBeUndefined()
    })

    it("refuses a missing delivery id before claiming or inserting", async () => {
        const inbox = await build()
        const tx = mockEntityManager()

        await expect(
            inbox.claimRow("zalo", undefined, tx, { entity: SpecReceiptEntity, row: () => ({}) }),
        ).rejects.toThrow("DATABASE_WEBHOOK_DELIVERY_ID_REQUIRED")

        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})
