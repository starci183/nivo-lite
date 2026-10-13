import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { WorkContext } from "@modules/domain/decisions"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { AUTOMATION_QUEUE } from "@modules/queues/automation"
import { AutomationPaymentReceiptsService } from "./automation-payment-receipts.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationPaymentReceiptsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { tx, outbox, receipts: moduleRef.get(AutomationPaymentReceiptsService) }
}

describe("AutomationPaymentReceiptsService", () => {
    it("queues the receipt of a reconciled transaction on the automation job, in a transaction", async () => {
        const { tx, outbox, receipts } = await build()

        await expect(receipts.receiptFor(CTX, { transactionId: "tx-1", invoiceId: "inv-1" })).resolves.toBeUndefined()

        expect(outbox.jobsOf(AUTOMATION_QUEUE)).toEqual([
            {
                queue: AUTOMATION_QUEUE,
                payload: { kind: "payment_receipt", workspaceId: "ws-1", transactionId: "tx-1", invoiceId: "inv-1" },
            },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })

    it("queues nothing for a payment with neither a transaction nor an invoice", async () => {
        const { outbox, receipts } = await build()

        await receipts.receiptFor(CTX, { transactionId: null, invoiceId: null })

        expect(outbox.jobs).toEqual([])
    })
})
