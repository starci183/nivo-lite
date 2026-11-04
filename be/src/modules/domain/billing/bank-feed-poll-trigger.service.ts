import { Injectable } from "@nestjs/common"
import { FirstPollEnqueueService } from "@modules/domain/connection-poll"
import type { ConnectionReadyPayload } from "@modules/events/api"
import { BANK_FEED_POLL_QUEUE, RECONCILE_BANK_FEED_JOB } from "@modules/queues/bank-feed-poll"
import { BankFeedPollService } from "./bank-feed-poll.service"

@Injectable()
/**
 * Starts the first poll of a connection the moment it is ready, so the transactions its provider held before the webhook existed are
 * recovered without waiting for the next scheduler tick, and the scheduler polls the connection hot for a while. A connection of a provider that cannot be read back is ignored.
 */
export class BankFeedPollTriggerService {
    constructor(
        private readonly poll: BankFeedPollService,
        private readonly firstPolls: FirstPollEnqueueService,
    ) {}

    /** Enqueues the one-connection reconcile job; the delivery's dedupe key is the job's, so a redelivery is one job. Answers whether it enqueued. */
    async enqueueFirstPoll(ready: ConnectionReadyPayload): Promise<boolean> {
        if (!this.poll.polls(ready.provider)) return false
        await this.firstPolls.enqueue({ queue: BANK_FEED_POLL_QUEUE, job: RECONCILE_BANK_FEED_JOB, ready })
        return true
    }
}
