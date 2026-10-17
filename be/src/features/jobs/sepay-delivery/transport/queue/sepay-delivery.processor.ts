import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { SEPAY_DELIVERY_QUEUE } from "@modules/queues/sepay-delivery"
import { ProcessSepayDeliveryStep } from "../../steps/process-sepay-delivery.step"

@Injectable()
/** Consumes the committed sepay receipt using the app's existing fenced job runner. */
export class SepayDeliveryProcessor extends FencedProcessor {
    readonly queue = SEPAY_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessSepayDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
