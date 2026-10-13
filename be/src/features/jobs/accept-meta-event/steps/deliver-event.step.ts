import { Injectable } from "@nestjs/common"
import { MetaInboxService } from "@modules/domain/meta-inbox"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/**
 * The one effect of the job: an event of a connected Page goes to the lead generation flow when it is the lead_gen agent's (a comment,
 * a mention, a Lead Ads form, a prospect's message), else a direct message becomes a stored customer message and a chat turn.
 */
export class DeliverEventStep implements JobStep {
    constructor(
        private readonly inbox: MetaInboxService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /**
     * Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then hands the event to its
     * conversation. The queue dedupes events by their Meta key, so a repeat never opens a second turn.
     */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        await this.inbox.deliverPayload(job.payload)
    }
}
