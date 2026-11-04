import { Injectable } from "@nestjs/common"
import { ZaloInboxPollService } from "@modules/domain/zalo-provider"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: every Zalo connection that holds a token is read back for the customer messages its webhook never delivered. */
export class ReconcileInboxStep implements JobStep {
    constructor(
        private readonly poll: ZaloInboxPollService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then polls. A payload that is not a poll payload does nothing. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "reconcile" })
        await this.poll.reconcileFromJob(job.payload)
    }
}
