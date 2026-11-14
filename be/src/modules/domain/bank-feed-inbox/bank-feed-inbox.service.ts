import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AccountDataIntakeService, scopedDeliveryIdOf } from "@modules/domain/account-data"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type {
    FeedReceiptPayload,
    BankFeedInboxReceiptLookup,
    BankFeedProvider,
    PendingBankFeedInboxReceipt,
} from "./bank-feed-inbox.contracts"
import { deliveryTypeOf, feedDeliveryRowsOf, feedReceiptOf } from "./bank-feed.normalise.policy"
import { BankFeedInboxLogEvent } from "./bank-feed-inbox.log-events"

@Injectable()
/**
 * Owns durable receipts while participating in the caller's atomic consuming transaction: each receipt is one `<provider>.delivery` row of
 * the account of its connection, keyed by the delivery id without the connection (its unique key is the dedupe), pending until its
 * consumer completes it.
 */
export class BankFeedReceiptService {
    constructor(
        private readonly intake: AccountDataIntakeService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Writes a delivery once using the caller's transaction; answers true only when this call wrote it. A connection nobody holds keeps nothing. */
    async claim(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
        payload: FeedReceiptPayload,
    ): Promise<boolean> {
        const scoped = scopedDeliveryIdOf(deliveryId)
        if (scoped === null) return this.unknown(provider, payload.connection)
        const written = await this.intake.write(
            manager,
            payload.connection,
            feedDeliveryRowsOf(provider, scoped.externalId, payload),
        )
        if (written.owner === null) return this.unknown(provider, payload.connection)
        return written.rows.some((row) => row.type === deliveryTypeOf(provider) && row.isNew)
    }

    /** Locks a pending delivery until its consumption and completion commit together; undefined when it is absent or already complete. */
    async lock(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
    ): Promise<BankFeedInboxReceiptLookup> {
        const scoped = scopedDeliveryIdOf(deliveryId)
        if (scoped === null) return undefined
        const row = await this.intake.lockPending(
            manager,
            deliveryTypeOf(provider),
            scoped.connectionId,
            scoped.externalId,
        )
        if (row === null) return undefined
        return { payload: feedReceiptOf(row.owner.connectionId, row.value), owner: row.owner, row }
    }

    /** Completes the locked delivery in the caller's transaction. */
    complete(manager: EntityManager, receipt: PendingBankFeedInboxReceipt): Promise<void> {
        return this.intake.complete(manager, receipt.row)
    }

    /** Logs a delivery whose connection nobody holds; it is not kept. */
    private unknown(provider: BankFeedProvider, connection: string): boolean {
        this.logger.warn(BankFeedInboxLogEvent.UnknownConnection, { provider, connection })
        return false
    }
}
