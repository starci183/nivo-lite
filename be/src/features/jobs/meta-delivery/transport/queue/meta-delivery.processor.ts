import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { META_DELIVERY_QUEUE } from "@modules/queues/meta-delivery"
import { ProcessMetaDeliveryStep } from "../../steps/process-meta-delivery.step"

@Injectable()
/** Consumes the committed meta receipt using the app's existing fenced job runner. */
export class MetaDeliveryProcessor extends FencedProcessor {
    readonly queue = META_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessMetaDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
