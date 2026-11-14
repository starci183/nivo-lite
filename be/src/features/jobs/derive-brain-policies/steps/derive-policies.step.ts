import { Injectable } from "@nestjs/common"
import { BrainPolicyDeriveService } from "@modules/domain/brain"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the policies of the workspace of the claimed job are derived from what changed in its truth graph. */
export class DerivePoliciesStep implements JobStep {
    constructor(
        private readonly derive: BrainPolicyDeriveService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then derives. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "derive" })
        await this.derive.run(job.payload)
    }
}
