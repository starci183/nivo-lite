import { Injectable } from "@nestjs/common"
import type { RecordOwnershipMoveParams } from "./conversation-ownership-events.contracts"
import { ConversationOwnershipEventEntity } from "./persistence/entities"

@Injectable()
/**
 * Owns the ownership history: the one writer of conversation_ownership_events. A move is recorded only inside the transaction that
 * moved the conversation, so the history never names an owner the conversation did not get.
 */
export class ConversationOwnershipEventsService {
    /** Records one move in the caller's transaction. */
    async record(params: RecordOwnershipMoveParams): Promise<void> {
        await params.manager.insert(ConversationOwnershipEventEntity, {
            workspaceId: params.workspaceId,
            conversationId: params.conversationId,
            fromAgentId: params.fromAgentId,
            toAgentId: params.toAgentId,
            reason: params.reason,
        })
    }
}
