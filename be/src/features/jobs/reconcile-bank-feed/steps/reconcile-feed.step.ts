import { Injectable } from "@nestjs/common"
import { BankFeedPollService } from "@modules/domain/billing"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: every bank connection that can be read back is polled for the transactions its webhook never delivered. */
export class ReconcileFeedStep implements JobStep {
    constructor(
        private readonly poll: BankFeedPollService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then polls. A payload that is not a poll payload does nothing. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "reconcile" })
        await this.poll.reconcileFromJob(job.payload)
    }
}
