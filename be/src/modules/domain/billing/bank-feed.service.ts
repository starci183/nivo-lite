import { BankFeedReceiptService, feedTransactionRowsOf, type IncomingCredit } from "@modules/domain/bank-feed-inbox"
import { AccountDataIntakeService } from "@modules/domain/account-data"
import type { BankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { BankFeedTriggerService } from "./bank-feed-trigger.service"

@Injectable()
/**
 * Consumes one recorded delivery of a payment connection, after its door proved it and claimed its `<provider>.delivery` row: the
 * account keeps every movement of the delivery as a `<provider>.transaction` row, the connection is marked as working, the new
 * movements are handed to the account's provider trigger, and the delivery is completed, all in one transaction. It decides nothing
 * about what a movement means.
 */
export class BankFeedService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly bankFeedInbox: BankFeedReceiptService,
        private readonly intake: AccountDataIntakeService,
        private readonly trigger: BankFeedTriggerService,
    ) {}

    /** Processes one recorded delivery; an absent or already completed delivery (a redelivery) does nothing. */
    processRecordedFeedDelivery(message: BankFeedDeliveryRecorded): Promise<void> {
        return this.entityManager.transaction(async (manager) => {
            const pending = await this.bankFeedInbox.lock(manager, message.provider, message.deliveryId)
            if (pending === undefined) return
            const { owner, payload } = pending
            const rows = feedTransactionRowsOf(message.provider, payload)
            const written = await this.intake.write(manager, owner.connectionId, rows)
            const [first] = payload.credits
            if (first !== undefined) await this.markFed(manager, owner.connectionId, first)
            await this.trigger.emit(manager, owner, rows, written)
            await this.bankFeedInbox.complete(manager, pending)
        })
    }

    /** Remembers that the connection works (what the connection wizard waits for), with its first movement as the first event. */
    private async markFed(tx: EntityManager, connectionId: string, credit: IncomingCredit): Promise<void> {
        const at = this.clock.now()
        await callDbFunction(tx, "public.connection_mark_fed", [
            connectionId,
            at,
            JSON.stringify({ amount: Math.round(credit.amount), content: credit.content, at: at.toISOString() }),
        ])
    }
}
