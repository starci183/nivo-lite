import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { isBankFeedDeliveryRecorded } from "@modules/queues/bank-feed-delivery"
import { BankFeedService } from "./bank-feed.service"

@Injectable()
/** Validates a receipt reference before fencing its deferred domain effect. */
export class BankFeedDeliveryService {
    constructor(
        private readonly inbox: BankFeedService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Invalid references do nothing; valid references advance before consuming the receipt. */
    async process(job: ClaimedJob): Promise<void> {
        if (!isBankFeedDeliveryRecorded(job.payload)) return
        await this.claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "bank-feed-delivery",
        })
        await this.inbox.processRecordedFeedDelivery(job.payload)
    }
}
