import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import { ProcessZaloDeliveryStep } from "../../steps/process-zalo-delivery.step"

@Injectable()
/** Consumes the committed zalo receipt using the app's existing fenced job runner. */
export class ZaloDeliveryProcessor extends FencedProcessor {
    readonly queue = ZALO_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessZaloDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
