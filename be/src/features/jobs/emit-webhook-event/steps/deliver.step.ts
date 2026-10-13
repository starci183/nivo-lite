import { Injectable } from "@nestjs/common"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the signed delivery of one business event to one webhook connection. */
export class EmitWebhookEventStep implements JobStep {
    constructor(
        private readonly webhooks: WebhookEventsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then delivers the event. */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "deliver" })
        await this.webhooks.deliver(job.payload)
    }
}
