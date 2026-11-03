import { Injectable } from "@nestjs/common"
import { PollSchedulerService } from "@modules/domain/connection-poll"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the connections that are due now are polled, under each provider's limits, and planned again. */
export class PollDueStep implements JobStep {
    constructor(
        private readonly scheduler: PollSchedulerService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then runs one scheduler tick. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "poll" })
        await this.scheduler.tick()
    }
}
