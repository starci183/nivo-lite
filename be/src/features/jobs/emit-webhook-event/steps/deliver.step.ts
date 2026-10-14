import { Injectable } from "@nestjs/common"
import { WebhookEventsService } from "@modules/domain/webhook-connections"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the signed delivery of one business event to one webhook connection. */
export class EmitWebhookEventStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly webhooks: WebhookEventsService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "deliver")
    }

    /** Delivers the event after the worker's claim has been checked. */
    protected perform(payload: object): Promise<unknown> {
        return this.webhooks.deliver(payload)
    }
}
