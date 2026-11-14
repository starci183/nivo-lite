import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AuthFailureReason } from "./connection-poll.contracts"
import { POLL_NEEDS_PERMISSION_REASON, POLL_NEEDS_REAUTH_REASON } from "./messages/connection-poll.messages"

@Injectable()
/** Tells the owner that a connection must be connected again: the connection shows the reason, and one owner work item is kept per outage. */
export class PollOwnerNoticeService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly connections: ConnectionsService,
        private readonly inboundEvents: InboundEventsService,
    ) {}

    /**
     * Marks the connection failing with the reason (a bad credential, or one without the permission to read) and keeps one owner work item for the
     * outage that began at `openedAt`; a repeat of the same outage is no new item.
     */
    async needsReauth(
        record: ConnectionRecord,
        openedAt: number,
        why: AuthFailureReason = "credential",
    ): Promise<void> {
        const reason = why === "permission" ? POLL_NEEDS_PERMISSION_REASON : POLL_NEEDS_REAUTH_REASON
        await this.connections.markFailing(record.id, reason)
        await this.connections.markHealth(record.id, { state: "needs_reauth", reason, checkedAt: new Date(openedAt).toISOString() })
        await this.entityManager.transaction((manager) =>
            this.inboundEvents.keepForOwner(manager, {
                workspaceId: record.workspaceId,
                channel: record.provider,
                sender: record.name,
                body: reason,
                eventId: `reauth:${record.id}:${openedAt}`,
            }),
        )
    }

    /**
     * Keeps one owner work item that the provider's plan does not let the connection be read back. The connection itself stays connected, because
     * its webhook still works; `text` is the provider's own words, and `at` makes the item one per time it became unavailable.
     */
    async unavailable(record: ConnectionRecord, text: string, at: number): Promise<void> {
        await this.entityManager.transaction((manager) =>
            this.inboundEvents.keepForOwner(manager, {
                workspaceId: record.workspaceId,
                channel: record.provider,
                sender: record.name,
                body: text,
                eventId: `unavailable:${record.id}:${at}`,
            }),
        )
    }
}
