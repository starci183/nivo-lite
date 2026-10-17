import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import { ProcessBankFeedDeliveryStep } from "../../steps/process-bank-feed-delivery.step"

@Injectable()
/** Consumes the committed bank-feed receipt using the app's existing fenced job runner. */
export class BankFeedDeliveryProcessor extends FencedProcessor {
    readonly queue = BANK_FEED_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessBankFeedDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
