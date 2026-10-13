import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { BANK_CREDIT_QUEUE, BankCreditQueue, isBankCreditPayload } from "./bank-credit.queue"

const payload = { workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: 150_000 }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [BankCreditQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(BankCreditQueue), outbox }
}

describe("BankCreditQueue", () => {
    it("writes the credit in the caller's transaction", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueBankCredit(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, BANK_CREDIT_QUEUE, payload)
    })
})

describe("isBankCreditPayload", () => {
    it("accepts the three fields and refuses anything else", () => {
        expect(isBankCreditPayload(payload)).toBe(true)
        expect(isBankCreditPayload({ ...payload, extra: true })).toBe(true)
        expect(isBankCreditPayload(null)).toBe(false)
        expect(isBankCreditPayload("credit")).toBe(false)
        expect(isBankCreditPayload({ inboundEventId: "event-1", amountVnd: 1 })).toBe(false)
        expect(isBankCreditPayload({ workspaceId: 1, inboundEventId: "event-1", amountVnd: 1 })).toBe(false)
        expect(isBankCreditPayload({ workspaceId: "ws-1", amountVnd: 1 })).toBe(false)
        expect(isBankCreditPayload({ workspaceId: "ws-1", inboundEventId: 1, amountVnd: 1 })).toBe(false)
        expect(isBankCreditPayload({ workspaceId: "ws-1", inboundEventId: "event-1" })).toBe(false)
        expect(isBankCreditPayload({ workspaceId: "ws-1", inboundEventId: "event-1", amountVnd: "1" })).toBe(false)
    })
})
