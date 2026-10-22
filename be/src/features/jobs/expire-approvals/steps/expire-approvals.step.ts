import { Injectable } from "@nestjs/common"
import { ApprovalRequestsService } from "@modules/domain/approval-requests"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the requests for approval that ran out of time go to the owner of their agent, and the half-way ones are reminded. */
export class ExpireApprovalsStep implements JobStep {
    constructor(
        private readonly approvals: ApprovalRequestsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then sweeps. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" })
        await this.approvals.sweep()
    }
}
