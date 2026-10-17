import { Injectable } from "@nestjs/common"
import type { ZaloDeliveryConsumer } from "./zalo-delivery.port"
import { isZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed zalo receipt. */
export class ZaloDeliveryPolicy {
    /** Records the worker's fence before the domain consumer can perform its receipt effect. */
    async run(job: ClaimedJob, claims: JobClaims, inbox: ZaloDeliveryConsumer): Promise<void> {
        if (!isZaloDeliveryRecorded(job.payload)) return
        await claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "zalo-delivery",
        })
        await inbox.processRecordedDelivery(job.payload)
    }
}
