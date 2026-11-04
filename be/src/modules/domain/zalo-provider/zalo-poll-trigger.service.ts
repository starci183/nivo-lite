import { Injectable } from "@nestjs/common"
import type { ConnectionReadyPayload } from "@modules/events/api"
import { FirstPollEnqueueService } from "@modules/domain/connection-poll"
import { RECONCILE_ZALO_INBOX_JOB, ZALO_INBOX_POLL_QUEUE } from "@modules/queues/zalo-inbox-poll"
import { ZaloInboxPollService } from "./zalo-poll.service"

@Injectable()
/**
 * Starts the first reconcile of a Zalo connection the moment its OAuth token is saved, so the customer messages that reached the OA before the
 * connection existed are recovered without waiting for the next scheduler tick, and the scheduler polls the connection hot for a while. A connection of any other provider is ignored.
 */
export class ZaloInboxPollTriggerService {
    constructor(
        private readonly poll: ZaloInboxPollService,
        private readonly firstPolls: FirstPollEnqueueService,
    ) {}

    /** Enqueues the one-connection reconcile job; the delivery's dedupe key is the job's, so a redelivery is one job. Answers whether it enqueued. */
    async enqueueFirstPoll(ready: ConnectionReadyPayload): Promise<boolean> {
        if (!this.poll.polls(ready.provider)) return false
        await this.firstPolls.enqueue({ queue: ZALO_INBOX_POLL_QUEUE, job: RECONCILE_ZALO_INBOX_JOB, ready })
        return true
    }
}
