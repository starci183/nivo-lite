import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { N8N_QUEUE, N8N_WEBHOOK_JOB } from "@modules/queues/n8n"
import { EmitWebhookEventStep } from "../../steps/deliver.step"

@Injectable()
/** The processor of the webhook delivery job: the runner claims and settles it; the one step posts the signed event to the connection. */
export class EmitWebhookEventProcessor extends FencedProcessor {
    readonly queue = N8N_QUEUE
    override readonly job = N8N_WEBHOOK_JOB

    constructor(private readonly step: EmitWebhookEventStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
