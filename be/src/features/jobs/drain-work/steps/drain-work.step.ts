import { Injectable } from "@nestjs/common"
import { ThreadWorkService } from "@modules/domain/thread-work"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The effect of the job: the queued chain steps of every workspace that has some go through the policy gate, and the agents whose
 * approval was settled by another door (the deadline, a decision elsewhere) go on in their work threads.
 */
export class DrainWorkStep implements JobStep {
    constructor(
        private readonly threadWork: ThreadWorkService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then drains. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "drain" })
        await this.threadWork.tick()
    }
}
