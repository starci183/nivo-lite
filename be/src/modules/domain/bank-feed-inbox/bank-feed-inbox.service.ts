import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectInbox } from "@modules/platform/inbox"
import type { EntityInbox } from "@modules/platform/inbox"
import type { FeedReceiptPayload, BankFeedInboxReceiptLookup, BankFeedProvider } from "./bank-feed-inbox.contracts"
import { BankFeedInboxEntity } from "./persistence/entities"

@Injectable()
/** Owns durable receipts while participating in the caller's atomic booking transaction. */
export class BankFeedReceiptService {
    constructor(@InjectInbox() private readonly inbox: EntityInbox) {}

    /** Claims a delivery once using the caller's transaction. */
    claim(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
        payload: FeedReceiptPayload,
    ): Promise<boolean> {
        return this.inbox.claimRow(provider, deliveryId, manager, {
            entity: BankFeedInboxEntity,
            row: { provider, deliveryId, payload },
        })
    }

    /** Locks a pending receipt until its booking and completion commit together. */
    async lock(
        manager: EntityManager,
        provider: BankFeedProvider,
        deliveryId: string,
    ): Promise<BankFeedInboxReceiptLookup> {
        const pending = await manager.findOne(BankFeedInboxEntity, {
            where: { provider, deliveryId, processedAt: IsNull() },
            lock: { mode: "pessimistic_write" },
        })
        if (pending === null) return undefined
        return { id: pending.id, payload: pending.payload }
    }

    /** Completes the locked receipt in the caller's transaction. */
    async complete(manager: EntityManager, id: string): Promise<void> {
        await manager.update(BankFeedInboxEntity, { id }, { processedAt: () => "now()" })
    }
}
