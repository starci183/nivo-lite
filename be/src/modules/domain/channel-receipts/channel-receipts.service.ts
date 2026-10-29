import { Injectable } from "@nestjs/common"
import { Like, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ChannelReceiptEntity } from "./persistence/entities"

@Injectable()
/** The receipts channels keep to do something at most once: today, the holding line a conversation gets within the hour. */
export class ChannelReceiptsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** True when a holding line already went out in the conversation since the given moment. */
    heldSince(workspaceId: string, conversationId: string, since: Date): Promise<boolean> {
        return this.entityManager.exists(ChannelReceiptEntity, {
            where: {
                workspaceId,
                channel: "holding",
                receiptId: Like(`${conversationId}:%`),
                createdAt: MoreThanOrEqual(since),
            },
        })
    }

    /** Remembers that a holding line went out in the conversation at the given moment. */
    async rememberHolding(workspaceId: string, conversationId: string, at: Date): Promise<void> {
        await this.entityManager.insert(ChannelReceiptEntity, {
            workspaceId,
            channel: "holding",
            receiptId: `${conversationId}:${at.getTime()}`,
        })
    }
}
