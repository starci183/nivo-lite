import { Injectable } from "@nestjs/common"
import { AgentStepJobService } from "@modules/domain/agent-runs"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the run the job names is driven until it waits or ends. */
export class AdvanceStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly job: AgentStepJobService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then advances. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "advance" })
        await this.job.run(job.payload)
    }
}
