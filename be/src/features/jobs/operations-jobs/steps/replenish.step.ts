import { Injectable } from "@nestjs/common"
import { InventoryReplenishService } from "@modules/domain/inventory"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the items whose stock moved are checked against their reorder point and low ones get a draft purchase order. */
export class ReplenishStep implements JobStep {
    constructor(
        private readonly replenishment: InventoryReplenishService,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Records the step with the token this worker holds first, so a stale token stops here; then drafts the orders (an item already covered by an open order is left out, so a repeat changes nothing). */
    async run(job: ClaimedJob): Promise<void> {
        await this.claims.advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "replenish" })
        await this.replenishment.replenishJob(job.payload)
    }
}
