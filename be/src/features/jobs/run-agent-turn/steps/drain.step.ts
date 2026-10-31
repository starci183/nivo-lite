import { Injectable } from "@nestjs/common"
import { AgentDrainJobService } from "@modules/domain/agent-schedules"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: one turn of the scope of an agent is taken and run, and the next drain starts when more is due there. */
export class DrainStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly drain: AgentDrainJobService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then drains. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "drain" })
        await this.drain.run(job.payload)
    }
}
