import { Injectable } from "@nestjs/common"
import { TeamChatTagDeliveryService } from "@modules/domain/team-chat"
import { InjectJobClaims, type ClaimedJob, type JobClaims, type JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the tag the job names is handed to the one event pipeline, in the api (the one app that drives runs). */
export class DeliverTagStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly tags: TeamChatTagDeliveryService,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then delivers. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        await this.tags.deliverJob(job.payload)
    }
}
