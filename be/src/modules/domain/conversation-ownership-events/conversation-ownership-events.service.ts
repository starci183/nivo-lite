import { Injectable } from "@nestjs/common"
import type { RecordOwnershipMoveParams } from "./conversation-ownership-events.contracts"
import { INSERT_OWNERSHIP_EVENT } from "./persistence/conversation-ownership-events.sql"

@Injectable()
/**
 * Owns the ownership history: the one writer of conversation_ownership_events. A move is recorded only inside the transaction that
 * moved the conversation, so the history never names an owner the conversation did not get.
 */
export class ConversationOwnershipEventsService {
    /** Records one move in the caller's transaction. */
    async record(params: RecordOwnershipMoveParams): Promise<void> {
        await params.manager.query(INSERT_OWNERSHIP_EVENT, [
            params.workspaceId,
            params.conversationId,
            params.fromAgentId,
            params.toAgentId,
            params.reason,
        ])
    }
}
