import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type {
    FeedReceiptPayload,
    PendingBankFeedInboxReceipt,
    BankFeedInboxReceiptLookup,
    BankFeedProvider,
} from "./bank-feed-inbox.contracts"
import {
    INSERT_BANK_FEED_INBOX,
    FIND_PENDING_BANK_FEED_INBOX,
    COMPLETE_BANK_FEED_INBOX,
} from "./persistence/bank-feed-inbox.sql"

@Injectable()
/** Owns durable receipts while participating in the caller's atomic booking transaction. */
export class BankFeedReceiptService {
    constructor(@InjectInbox() private readonly inbox: Inbox) {}

    /** Claims a delivery once using the caller's transaction. */
    claim(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
        payload: FeedReceiptPayload,
    ): Promise<boolean> {
        return this.inbox.claim(provider, deliveryId, manager, { insert: INSERT_BANK_FEED_INBOX, payload })
    }

    /** Locks a pending receipt until its booking and completion commit together. */
    async lock(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
    ): Promise<BankFeedInboxReceiptLookup> {
        const [pending] = await manager.query<Array<PendingBankFeedInboxReceipt>>(FIND_PENDING_BANK_FEED_INBOX, [
            provider,
            deliveryId,
        ])
        return pending
    }

    /** Completes the locked receipt in the caller's transaction. */
    async complete(manager: EntityManager, id: string): Promise<void> {
        await manager.query(COMPLETE_BANK_FEED_INBOX, [id])
    }
}
