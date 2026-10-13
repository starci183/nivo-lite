import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { PaymentReceiptRequest, PaymentReceipts, WorkContext } from "@modules/domain/decisions"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AUTOMATION_QUEUE, AUTOMATION_TICK_JOB } from "@modules/queues/automation"
import type { PaymentReceiptEventPayload } from "@modules/queues/automation"

@Injectable()
/**
 * The receipt of a reconciled payment: the automation job starts the receipt pipeline (when the shop switched it on and the customer
 * has an email), so a receipt never slows or breaks the payment flow. One job per transaction, or per invoice without one.
 */
export class AutomationPaymentReceiptsService implements PaymentReceipts {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}

    /** Queues the receipt; a payment with neither a transaction nor an invoice has nothing to send. */
    async receiptFor(ctx: WorkContext, request: PaymentReceiptRequest): Promise<void> {
        const subject = request.transactionId ?? request.invoiceId
        if (subject === null) return
        const event: PaymentReceiptEventPayload = {
            kind: "payment_receipt",
            workspaceId: ctx.workspaceId,
            transactionId: request.transactionId,
            invoiceId: request.invoiceId,
        }
        await this.entityManager.transaction((tx) =>
            this.outbox.write(tx, AUTOMATION_QUEUE, event, {
                job: AUTOMATION_TICK_JOB,
                dedupeKey: `receipt:${subject}`,
            }),
        )
    }
}
