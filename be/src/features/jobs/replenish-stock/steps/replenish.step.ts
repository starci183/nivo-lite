import { Injectable } from "@nestjs/common"
import { InventoryReplenishService } from "@modules/domain/inventory"
import { AdvancingJobStepPolicy, InjectJobClaims } from "@modules/platform/jobs"
import type { JobClaims, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The one effect of the job: the items whose stock moved are checked against their reorder point and low ones get a draft purchase order. */
export class ReplenishStep extends AdvancingJobStepPolicy implements JobStep {
    constructor(
        private readonly replenishment: InventoryReplenishService,
        @InjectJobClaims() claims: JobClaims,
    ) {
        super(claims, "replenish")
    }

    /** Drafts the orders after the claim is checked; items already covered by an open order are left out. */
    protected perform(payload: object): Promise<unknown> {
        return this.replenishment.replenishJob(payload)
    }
}
