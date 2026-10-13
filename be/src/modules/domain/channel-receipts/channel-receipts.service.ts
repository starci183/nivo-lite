import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { HoldingReceiptRow } from "./persistence/channel-receipts.rows"
import { FIND_RECENT_HOLDING, INSERT_HOLDING_RECEIPT } from "./persistence/channel-receipts.sql"

@Injectable()
/** The receipts channels keep to do something at most once: today, the holding line a conversation gets within the hour. */
export class ChannelReceiptsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** True when a holding line already went out in the conversation since the given moment. */
    async heldSince(workspaceId: string, conversationId: string, since: Date): Promise<boolean> {
        const rows = await this.entityManager.query<Array<HoldingReceiptRow>>(FIND_RECENT_HOLDING, [workspaceId, `${conversationId}:%`, since])
        return rows.length > 0
    }

    /** Remembers that a holding line went out in the conversation at the given moment. */
    async rememberHolding(workspaceId: string, conversationId: string, at: Date): Promise<void> {
        await this.entityManager.query(INSERT_HOLDING_RECEIPT, [workspaceId, `${conversationId}:${at.getTime()}`])
    }
}
