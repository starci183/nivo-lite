import { Injectable } from "@nestjs/common"
import { BankFeedDeliveryService } from "@modules/domain/billing"
import type { ClaimedJob, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed bank-feed receipt. */
export class ProcessBankFeedDeliveryStep implements JobStep {
    constructor(private readonly delivery: BankFeedDeliveryService) {}

    /** Delegates receipt validation, fencing and consumption to billing. */
    run(job: ClaimedJob): Promise<void> {
        return this.delivery.process(job)
    }
}
