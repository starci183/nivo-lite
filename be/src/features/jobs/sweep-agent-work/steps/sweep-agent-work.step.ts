import { Injectable } from "@nestjs/common"
import { AgentWorkSweepService } from "@modules/domain/agent-schedules"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: one bounded pass over what the database says is due in the work of the agents. */
export class SweepAgentWorkStep implements JobStep {
    constructor(
        private readonly sweep: AgentWorkSweepService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds before the pass, so a stale token stops before any effect. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "sweep" })
        await this.sweep.sweep()
    }
}
