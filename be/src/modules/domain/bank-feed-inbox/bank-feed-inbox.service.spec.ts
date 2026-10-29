import { IsNull } from "typeorm"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { Test } from "@nestjs/testing"
import { fakeInbox, mockEntityManager } from "@starci/jest-preset"
import { INBOX } from "@modules/platform/inbox"
import { BankFeedReceiptService } from "./bank-feed-inbox.service"
import type { FeedReceiptPayload } from "./bank-feed-inbox.contracts"
import { BankFeedInboxEntity } from "./persistence/entities"

/** Stands for the `() => "now()"` expression a write hands the database. */
const SQL_EXPRESSION: unknown = expect.any(Function)

const payload: FeedReceiptPayload = {
    connection: "conn-1",
    credits: [{ amount: 1000, content: "payment", eventId: "bank-1", fallbackBankName: "Bank" }],
}
const pending = Object.assign(new BankFeedInboxEntity(), {
    id: "receipt-1",
    provider: "payos",
    deliveryId: "delivery-1",
    receivedAt: new Date("2026-10-12T10:00:00Z"),
    payload,
    processedAt: null,
})

const build = async (row: BankFeedInboxEntity | null = pending) => {
    const manager = mockEntityManager({
        findOne: [BankFeedInboxEntity, row],
        update: [BankFeedInboxEntity, {}],
    })
    const inbox = fakeInbox()
    const moduleRef = await Test.createTestingModule({
        providers: [BankFeedReceiptService, { provide: INBOX, useValue: inbox }],
    }).compile()
    return { service: moduleRef.get(BankFeedReceiptService), inbox, manager }
}

describe("BankFeedReceiptService", () => {
    it.each([true, false])("returns the claim result %s in the caller's transaction", async (claimed) => {
        const { service, inbox, manager } = await build()
        if (!claimed) inbox.seen("payos", "delivery-1")
        await expect(service.claim(manager, "payos", "delivery-1", payload)).resolves.toBe(claimed)
        expect(inbox.claims).toEqual([{ source: "payos", eventId: "delivery-1" }])
        expect(inbox.receipts.map(({ entity, row }) => ({ entity, row }))).toEqual(
            claimed
                ? [{ entity: BankFeedInboxEntity, row: { provider: "payos", deliveryId: "delivery-1", payload } }]
                : [],
        )
        expect(manager.findOne).not.toHaveBeenCalled()
        expect(manager.update).not.toHaveBeenCalled()
    })

    it("returns the receipt locked by the supplied manager", async () => {
        const { service, manager } = await build()
        await expect(service.lock(manager, "payos", "delivery-1")).resolves.toEqual({ id: "receipt-1", payload })
        expect(manager.findOne).toHaveBeenCalledWith(BankFeedInboxEntity, {
            where: { provider: "payos", deliveryId: "delivery-1", processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
    })

    it("returns undefined for a missing or completed receipt", async () => {
        const { service, manager } = await build(null)
        await expect(service.lock(manager, "payos", "delivery-1")).resolves.toBeUndefined()
        expect(manager.findOne).toHaveBeenCalledTimes(1)
    })

    it("completes the receipt with the supplied manager", async () => {
        const { service, manager } = await build()
        await expect(service.complete(manager, "receipt-1")).resolves.toBeUndefined()
        expect(manager.update).toHaveBeenCalledWith(
            BankFeedInboxEntity,
            { id: "receipt-1" },
            { processedAt: SQL_EXPRESSION },
        )
    })

    it("stamps the completed receipt with the database time", async () => {
        const { service, manager } = await build()

        await service.complete(manager, "receipt-1")

        expect(evaluatedValues(manager.update.mock.calls[0]?.[2]).processedAt).toBe("now()")
    })

    it("propagates a refused claim to the transaction owner", async () => {
        const { service, inbox, manager } = await build()
        const failure = new Error("claim failed")
        inbox.failNext("claimRow", failure)
        await expect(service.claim(manager, "payos", "delivery-1", payload)).rejects.toBe(failure)
    })

    it.each(["lock", "complete"])("propagates a failed %s to the transaction owner", async (operation) => {
        const { service, manager } = await build()
        const failure = new Error("database failed")
        manager.findOne.mockRejectedValue(failure)
        manager.update.mockRejectedValue(failure)
        const result =
            operation === "lock" ? service.lock(manager, "payos", "delivery-1") : service.complete(manager, "receipt-1")
        await expect(result).rejects.toBe(failure)
    })
})
