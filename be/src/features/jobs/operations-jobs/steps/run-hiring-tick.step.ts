import { Injectable } from "@nestjs/common"
import { HiringTickService } from "@modules/domain/hiring"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the reminders, lapsing, closing and retention of one workspace hiring. */
export class RunHiringTickStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly tick: HiringTickService,
    ) {}

    /** Records the step with the token this worker holds first, so a stale token stops here; then ticks the workspace (every step of the tick marks what it did, so a repeat is safe). */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken, payload } = job
        await this.claims.advance({ jobId, expectedFencingToken: fencingToken, step: "tick" })
        await this.tick.runJob(payload)
    }
}
