import { Injectable } from "@nestjs/common"
import { AgentScheduleFireService } from "@modules/domain/agent-schedules"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the slot that came up becomes one schedule wake on the one road. */
export class FireStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly fires: AgentScheduleFireService,
    ) {}

    /** Records the step with the token this worker holds FIRST; a repeated slot writes no second wake, so the fence only keeps a stale worker from racing the fresh one. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "fire" })
        await this.fires.fire(job.payload)
    }
}
