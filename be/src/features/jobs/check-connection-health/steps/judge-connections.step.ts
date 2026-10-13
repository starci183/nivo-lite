import { Injectable } from "@nestjs/common"
import { ConnectionHealthService } from "@modules/domain/channels"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: every connection that is set up is judged and a changed verdict is recorded on it. */
export class JudgeConnectionsStep implements JobStep {
    constructor(
        private readonly health: ConnectionHealthService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST; then judges, which writes a verdict only when it changed. */
    async run(job: ClaimedJob): Promise<void> {
        const recorded = this.claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "judge",
        })
        await recorded
        await this.health.checkFromJob(job.payload)
    }
}
