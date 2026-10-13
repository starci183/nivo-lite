import { Injectable } from "@nestjs/common"
import { BankFeedService } from "@modules/domain/billing"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: until an accounting agent matches the credit, its inbound event waits for the owner check. */
export class HoldForOwnerCheckStep implements JobStep {
    constructor(
        private readonly feed: BankFeedService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then holds the
     * credit for the owner (an event already past that stage is left as it is, so a repeat changes nothing). Any other payload
     * changes nothing.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "hold" })
        await this.feed.holdForOwnerCheck(job.payload)
    }
}
