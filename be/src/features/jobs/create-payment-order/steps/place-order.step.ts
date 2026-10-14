import { Injectable } from "@nestjs/common"
import { PaymentOrderRequestsService } from "@modules/domain/payment-order-requests"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: makes the payment order a member asked for and answers the request row. */
export class PlaceOrderStep implements JobStep {
    constructor(
        private readonly requests: PaymentOrderRequestsService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds FIRST, so a stale token stops here before any effect; then answers the request. */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken: expectedFencingToken } = job
        await this.claims.advance({ jobId, expectedFencingToken, step: "place" })
        await this.requests.answer(job.payload)
    }
}
