import { Injectable } from "@nestjs/common"
import { InventoryDeductionService } from "@modules/domain/inventory"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the goods of a confirmed order leave stock, one movement per item per order. */
export class DeductStep implements JobStep {
    constructor(
        @InjectJobClaims() private readonly claims: JobClaims,
        private readonly stock: InventoryDeductionService,
    ) {}

    /** Records the step with the token this worker holds first, so a stale token stops here; then deducts (a movement is deduped by order and item, so a repeat changes nothing). */
    async run(job: ClaimedJob): Promise<void> {
        const { jobId, fencingToken, payload } = job
        await this.claims.advance({ jobId, expectedFencingToken: fencingToken, step: "deduct" })
        await this.stock.deductOrderJob(payload)
    }
}
