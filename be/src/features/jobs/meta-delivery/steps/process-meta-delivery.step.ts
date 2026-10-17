import { Injectable } from "@nestjs/common"
import { MetaDeliveryService } from "@modules/domain/meta-inbox"
import type { ClaimedJob, JobStep } from "@modules/platform/jobs"

@Injectable()
/** Delegates a committed receipt to its fenced domain consumer. */
export class ProcessMetaDeliveryStep implements JobStep {
    constructor(private readonly delivery: MetaDeliveryService) {}

    /** Hands the claimed job to the owner that validates and processes it. */
    run(job: ClaimedJob): Promise<void> {
        return this.delivery.process(job)
    }
}
