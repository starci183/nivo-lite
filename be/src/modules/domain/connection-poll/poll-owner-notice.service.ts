import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { POLL_NEEDS_REAUTH_REASON } from "./messages/connection-poll.messages"

@Injectable()
/** Tells the owner that a connection must be connected again: the connection shows the reason, and one owner work item is kept per outage. */
export class PollOwnerNoticeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
        private readonly inboundEvents: InboundEventsService,
    ) {}

    /** Marks the connection failing and keeps one owner work item for the outage that began at `openedAt`; a repeat of the same outage is no new item. */
    async needsReauth(record: ConnectionRecord, openedAt: number): Promise<void> {
        await this.connections.markFailing(record.id, POLL_NEEDS_REAUTH_REASON)
        await this.entityManager.transaction((manager) =>
            this.inboundEvents.keepForOwner(manager, {
                workspaceId: record.workspaceId,
                channel: record.provider,
                sender: record.name,
                body: POLL_NEEDS_REAUTH_REASON,
                eventId: `reauth:${record.id}:${openedAt}`,
            }),
        )
    }
}
