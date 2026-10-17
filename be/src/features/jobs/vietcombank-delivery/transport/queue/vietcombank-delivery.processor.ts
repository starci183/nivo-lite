import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { VIETCOMBANK_DELIVERY_QUEUE } from "@modules/queues/vietcombank-delivery"
import { ProcessVietcombankDeliveryStep } from "../../steps/process-vietcombank-delivery.step"

@Injectable()
/** Consumes the committed vietcombank receipt using the app's existing fenced job runner. */
export class VietcombankDeliveryProcessor extends FencedProcessor {
    readonly queue = VIETCOMBANK_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessVietcombankDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
