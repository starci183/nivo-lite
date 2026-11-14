import { Injectable } from "@nestjs/common"
import type { ChannelTarget } from "./channels.contracts"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { CHANNEL_PLAN_NOTICE } from "./messages/channels.messages"

/** The series of the outage notices of one connection. */
const seriesOf = (connectionId: string): string => `channel-plan:${connectionId}`

@Injectable()
/**
 * Tells the owner, once per outage of a connection, that the plan of the channel does not let the agent answer customers there. The
 * channel's own words for the refusal stay with its provider; the owner sees one work item in the Office that says what to do, however
 * often a reply is refused meanwhile. The outage ends when the owner closes the item or a reply later reaches a customer on the
 * connection; the next refusal then raises a new item.
 */
export class ChannelPlanNoticeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
        private readonly inboundEvents: InboundEventsService,
    ) {}

    /** Keeps the one open owner work item of the outage of the connection the conversation runs on; a conversation with no connection has nothing to upgrade. */
    async planBlocked(target: ChannelTarget): Promise<void> {
        const connectionId = target.connectionId
        if (connectionId === null) return
        const connection = await this.connections.find(target.workspaceId, connectionId)
        await this.entityManager.transaction((manager) =>
            this.inboundEvents.keepOutageForOwner(manager, {
                workspaceId: target.workspaceId,
                channel: target.channel,
                sender: connection?.name ?? target.channel,
                body: CHANNEL_PLAN_NOTICE,
                eventId: seriesOf(connectionId),
            }),
        )
    }

    /** A reply reached a customer on the connection, so its plan allows replies again: the open item of the outage is closed. */
    async recovered(target: ChannelTarget): Promise<void> {
        if (target.connectionId === null) return
        await this.inboundEvents.closeOutage(target.workspaceId, target.channel, seriesOf(target.connectionId))
    }
}
