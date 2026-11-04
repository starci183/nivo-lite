import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ConversationTarget } from "@modules/domain/agent-conversations"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { CHANNEL_PLAN_NOTICE } from "./messages/channels.messages"

@Injectable()
/**
 * Tells the owner, once per connection, that the plan of the channel does not let the agent answer customers there. The channel's own
 * words for the refusal stay with its provider; the owner sees one work item in the Office that says what to do, however often a reply
 * is refused again.
 */
export class ChannelPlanNoticeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
        private readonly inboundEvents: InboundEventsService,
    ) {}

    /** Keeps the one owner work item of the connection the conversation runs on; a conversation with no connection has nothing to upgrade. */
    async planBlocked(target: ConversationTarget): Promise<void> {
        if (target.connectionId === null) return
        const connection = await this.connections.find(target.workspaceId, target.connectionId)
        await this.entityManager.transaction((manager) =>
            this.inboundEvents.keepForOwner(manager, {
                workspaceId: target.workspaceId,
                channel: target.channel,
                sender: connection?.name ?? target.channel,
                body: CHANNEL_PLAN_NOTICE,
                eventId: `channel-plan:${target.connectionId}`,
            }),
        )
    }
}
