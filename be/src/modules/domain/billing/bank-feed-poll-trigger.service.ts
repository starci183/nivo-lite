import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { PollScheduleService } from "@modules/domain/connection-poll"
import type { ConnectionReadyPayload } from "@modules/events/api"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { BANK_FEED_POLL_QUEUE, RECONCILE_BANK_FEED_JOB } from "@modules/queues/bank-feed-poll"
import type { BankFeedPollPayload } from "@modules/queues/bank-feed-poll"
import { BankFeedPollService } from "./bank-feed-poll.service"

@Injectable()
/**
 * Starts the first poll of a connection the moment it is ready, so the transactions its provider held before the webhook existed are
 * recovered without waiting for the next scheduler tick, and the scheduler polls the connection hot for a while. A connection of a provider that cannot be read back is ignored.
 */
export class BankFeedPollTriggerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        private readonly poll: BankFeedPollService,
        private readonly schedule: PollScheduleService,
    ) {}

    /** Enqueues the one-connection reconcile job; the delivery's dedupe key is the job's, so a redelivery is one job. Answers whether it enqueued. */
    async enqueueFirstPoll(ready: ConnectionReadyPayload): Promise<boolean> {
        if (!this.poll.polls(ready.provider)) return false
        const payload: BankFeedPollPayload = { connectionId: ready.connectionId, workspaceId: ready.workspaceId }
        await this.entityManager.transaction((tx) =>
            this.outbox.write(tx, BANK_FEED_POLL_QUEUE, payload, {
                job: RECONCILE_BANK_FEED_JOB,
                dedupeKey: `${BANK_FEED_POLL_QUEUE}:ready:${ready.dedupeKey}`,
            }),
        )
        await this.schedule.markReady(ready.connectionId)
        return true
    }
}
