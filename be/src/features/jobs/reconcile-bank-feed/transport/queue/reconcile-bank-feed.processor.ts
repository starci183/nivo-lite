import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BANK_FEED_POLL_QUEUE } from "@modules/queues/bank-feed-poll"
import { ReconcileFeedStep } from "../../steps/reconcile-feed.step"

@Injectable()
/** The processor of the reconcile-bank-feed job: every scheduler tick, and every connection that became ready, runs the one step. */
export class ReconcileBankFeedProcessor extends FencedProcessor {
    readonly queue: "bank-feed-poll" = BANK_FEED_POLL_QUEUE

    constructor(private readonly reconcile: ReconcileFeedStep) {
        super()
    }

    /** Polls the bank feeds; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.reconcile.run(job)
    }
}
