import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { ConnectionReadyPayload } from "@modules/events/api"
import { PollScheduleService } from "@modules/domain/connection-poll"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { RECONCILE_ZALO_INBOX_JOB, ZALO_INBOX_POLL_QUEUE } from "@modules/queues/zalo-inbox-poll"
import type { ZaloInboxPollPayload } from "@modules/queues/zalo-inbox-poll"
import { ZaloInboxPollService } from "./zalo-poll.service"

@Injectable()
/**
 * Starts the first reconcile of a Zalo connection the moment its OAuth token is saved, so the customer messages that reached the OA before the
 * connection existed are recovered without waiting for the next scheduler tick, and the scheduler polls the connection hot for a while. A connection of any other provider is ignored.
 */
export class ZaloInboxPollTriggerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly poll: ZaloInboxPollService,
        private readonly schedule: PollScheduleService,
    ) {}

    /** Enqueues the one-connection reconcile job; the delivery's dedupe key is the job's, so a redelivery is one job. Answers whether it enqueued. */
    async enqueueFirstPoll(ready: ConnectionReadyPayload): Promise<boolean> {
        if (!this.poll.polls(ready.provider)) return false
        const payload: ZaloInboxPollPayload = { connectionId: ready.connectionId, workspaceId: ready.workspaceId }
        await this.entityManager.transaction((tx) =>
            this.outbox.write(tx, ZALO_INBOX_POLL_QUEUE, payload, {
                job: RECONCILE_ZALO_INBOX_JOB,
                dedupeKey: `${ZALO_INBOX_POLL_QUEUE}:ready:${ready.dedupeKey}`,
            }),
        )
        await this.schedule.markReady(ready.connectionId)
        return true
    }
}
