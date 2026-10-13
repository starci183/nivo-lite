import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { INVENTORY_ORDER_QUEUE } from "@modules/queues/inventory-order"
import { DeductStep } from "../../steps/deduct.step"

@Injectable()
/** The processor of the deduct-order job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class DeductOrderProcessor extends FencedProcessor {
    readonly queue = INVENTORY_ORDER_QUEUE

    constructor(private readonly deduct: DeductStep) {
        super()
    }

    /** Deducts the order; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.deduct.run(job)
    }
}
