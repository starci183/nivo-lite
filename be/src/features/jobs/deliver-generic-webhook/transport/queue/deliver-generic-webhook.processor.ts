import { Injectable } from "@nestjs/common"
import { FencedProcessor, type ClaimedJob } from "@modules/platform/jobs"
import { GENERIC_WEBHOOK_QUEUE, GenericWebhookJob } from "@modules/queues/generic-webhook"
import { DeliverStep } from "../../steps/deliver.step"

/** How many events one process delivers at once: each wake is its own row under its own fact key, so deliveries do not wait on each other. */
const DELIVER_CONCURRENCY = 4

@Injectable()
/** The processor of the deliver job of the generic-webhook queue: the runner claims and settles it; `process` delegates to the one step. */
export class DeliverGenericWebhookProcessor extends FencedProcessor {
    readonly queue: "generic_webhook" = GENERIC_WEBHOOK_QUEUE

    override readonly job: GenericWebhookJob.Deliver = GenericWebhookJob.Deliver

    override readonly concurrency: 4 = DELIVER_CONCURRENCY

    constructor(private readonly deliver: DeliverStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.deliver.run(job)
    }
}
