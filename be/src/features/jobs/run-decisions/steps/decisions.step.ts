import { Injectable } from "@nestjs/common"
import { DecisionsQueueService } from "@modules/domain/office-command-candidates"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one step of a job of the decisions queue. */
export class DecisionsStep implements JobStep {
    constructor(
        private readonly queue: DecisionsQueueService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then does the work the payload names. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "decide" })
        await this.queue.handle(job.payload)
    }
}
