import { Injectable } from "@nestjs/common"
import { isMetaDeliveryRecorded } from "@modules/queues/meta-delivery"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { InjectMetaReceiptProcessor } from "./meta-inbox.decorators"
import type { MetaReceiptProcessor } from "./meta-inbox.port"

@Injectable()
/** Validates deferred receipts and records their worker fence before processing them. */
export class MetaDeliveryService {
    constructor(
        @InjectMetaReceiptProcessor() private readonly receipts: MetaReceiptProcessor,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Invalid payloads leave both the job progress and the receipt untouched. */
    async process(job: ClaimedJob): Promise<void> {
        if (!isMetaDeliveryRecorded(job.payload)) return
        await this.claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "meta-delivery",
        })
        await this.receipts.processRecordedDelivery(job.payload)
    }
}
