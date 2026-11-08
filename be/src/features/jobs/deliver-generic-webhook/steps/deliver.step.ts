import { Injectable } from "@nestjs/common"
import { GenericWebhookJobService } from "@modules/domain/agent-inbound"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the event the job names is handed to the door that wakes the agents. */
export class DeliverStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly job: GenericWebhookJobService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then delivers. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        await this.job.run(job.payload)
    }
}
